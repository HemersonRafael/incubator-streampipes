/*
 * Licensed to the Apache Software Foundation (ASF) under one or more
 * contributor license agreements.  See the NOTICE file distributed with
 * this work for additional information regarding copyright ownership.
 * The ASF licenses this file to You under the Apache License, Version 2.0
 * (the "License"); you may not use this file except in compliance with
 * the License.  You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 */

import { Directive, EventEmitter, HostBinding, Input, OnDestroy, OnInit, Output } from '@angular/core';
import { GridsterItem, GridsterItemComponent } from 'angular-gridster2';
import { WidgetConfigurationService } from '../../../services/widget-configuration.service';
import {
  DataExplorerDataConfig,
  DataExplorerField,
  DataViewQueryGeneratorService,
  DataExplorerWidgetModel,
  SpQueryResult,
  DashboardItem,
  DatalakeRestService,
  TimeSettings } from '@streampipes/platform-services';
import { ResizeService } from '../../../services/resize.service';
import { FieldProvider } from '../../../models/dataview-dashboard.model';
import { Observable, Subscription, zip } from 'rxjs';
import { DataExplorerFieldProviderService } from '../../../services/data-explorer-field-provider-service';
import { BaseWidgetData } from './data-explorer-widget-data';
import { TimeSelectionService } from '../../../services/time-selection.service';

@Directive()
export abstract class BaseDataExplorerWidgetDirective<T extends DataExplorerWidgetModel> implements BaseWidgetData<T>, OnInit, OnDestroy {

  private static TOO_MUCH_DATA_PARAMETER = 10000;

  @Output()
  removeWidgetCallback: EventEmitter<boolean> = new EventEmitter();

  @Output()
  timerCallback: EventEmitter<boolean> = new EventEmitter();

  @Input() gridsterItem: GridsterItem;
  @Input() gridsterItemComponent: GridsterItemComponent;
  @Input() editMode: boolean;

  @Input() timeSettings: TimeSettings;

  @Input() dataViewDashboardItem: DashboardItem;
  @Input() dataExplorerWidget: T;

  @HostBinding('class') className = 'h-100';

  public selectedProperties: string[];

  public showNoDataInDateRange: boolean;
  public showData: boolean;
  public showIsLoadingData: boolean;
  public showTooMuchData: boolean;
  public amountOfTooMuchEvents: number;

  fieldProvider: FieldProvider;

  widgetConfigurationSub: Subscription;
  resizeSub: Subscription;
  timeSelectionSub: Subscription;

  constructor(protected dataLakeRestService: DatalakeRestService,
              protected widgetConfigurationService: WidgetConfigurationService,
              protected resizeService: ResizeService,
              protected dataViewQueryGeneratorService: DataViewQueryGeneratorService,
              public fieldService: DataExplorerFieldProviderService,
              protected timeSelectionService: TimeSelectionService) {
  }

  ngOnInit(): void {
    this.showData = true;
    const sourceConfigs = this.dataExplorerWidget.dataConfig.sourceConfigs;
    this.fieldProvider = this.fieldService.generateFieldLists(sourceConfigs);
    this.widgetConfigurationSub = this.widgetConfigurationService.configurationChangedSubject.subscribe(refreshMessage => {
      if (refreshMessage.widgetId === this.dataExplorerWidget._id) {
        if (refreshMessage.refreshData) {
          const newFieldsProvider = this.fieldService.generateFieldLists(sourceConfigs);
          const addedFields = this.fieldService.getAddedFields(this.fieldProvider.allFields, newFieldsProvider.allFields);
          const removedFields = this.fieldService.getRemovedFields(this.fieldProvider.allFields, newFieldsProvider.allFields);
          this.fieldProvider = this.fieldService.generateFieldLists(sourceConfigs);
          this.handleUpdatedFields(addedFields, removedFields);
          this.updateData();
        }

        if (refreshMessage.refreshView) {
          this.refreshView();
        }
      }
    });
    this.resizeSub = this.resizeService.resizeSubject.subscribe(info => {
      if (info.gridsterItem.id === this.dataExplorerWidget._id) {
        this.onResize(this.gridsterItemComponent.width, this.gridsterItemComponent.height - 40);
      }
    });
    this.timeSelectionSub = this.timeSelectionService.timeSelectionChangeSubject.subscribe(ts => {
      this.timeSettings = ts;
      this.updateData();
    });
    this.updateData();
    this.onResize(this.gridsterItemComponent.width, this.gridsterItemComponent.height - 40);
  }

  ngOnDestroy(): void {
    this.widgetConfigurationSub.unsubscribe();
    this.resizeSub.unsubscribe();
    this.timeSelectionSub.unsubscribe();
  }

  public removeWidget() {
    this.removeWidgetCallback.emit(true);
  }

  public setShownComponents(showNoDataInDateRange: boolean,
                            showData: boolean,
                            showIsLoadingData: boolean,
                            showTooMuchData: boolean = false) {

    this.showNoDataInDateRange = showNoDataInDateRange;
    this.showData = showData;
    this.showIsLoadingData = showIsLoadingData;
    this.showTooMuchData = showTooMuchData;
  }

  public updateData(includeTooMuchEventsParameter: boolean = true) {
    this.beforeDataFetched();

    this.loadData(includeTooMuchEventsParameter);
  }

  private loadData(includeTooMuchEventsParameter: boolean) {

    let observables: Observable<SpQueryResult>[];

    if (includeTooMuchEventsParameter && !this.dataExplorerWidget.dataConfig.ignoreTooMuchDataWarning) {
      observables = this
          .dataViewQueryGeneratorService
          .generateObservables(
              this.timeSettings.startTime,
              this.timeSettings.endTime,
              this.dataExplorerWidget.dataConfig as DataExplorerDataConfig,
              BaseDataExplorerWidgetDirective.TOO_MUCH_DATA_PARAMETER
          );
    } else {
      observables = this
          .dataViewQueryGeneratorService
          .generateObservables(
              this.timeSettings.startTime,
              this.timeSettings.endTime,
              this.dataExplorerWidget.dataConfig as DataExplorerDataConfig);
    }

    this.timerCallback.emit(true);
    zip(...observables).subscribe(results => {
      results.forEach((result, index) => result.sourceIndex = index);
      this.validateReceivedData(results);
      // this.onDataReceived(results);
      this.refreshView();
      this.timerCallback.emit(false);
    });
  }

  validateReceivedData(spQueryResults: SpQueryResult[]) {

    const spQueryResult = spQueryResults[0];

    if (spQueryResult.total === 0) {
      this.setShownComponents(true, false, false, false);
    } else if (spQueryResult['spQueryStatus'] === 'TOO_MUCH_DATA') {
      this.amountOfTooMuchEvents = spQueryResult.total;
      this.setShownComponents(false, false, false, true);
    } else {
      this.onDataReceived(spQueryResults);
    }

  }

  loadDataWithTooManyEvents() {
    this.updateData(false);
  }

  isTimestamp(field: DataExplorerField) {
    return this.fieldProvider.primaryTimestampField && this.fieldProvider.primaryTimestampField.fullDbName === field.fullDbName;
  }

  getColumnIndex(field: DataExplorerField,
                 data: SpQueryResult) {
    return data.headers.indexOf(field.fullDbName);
  }

  protected updateFieldSelection(fieldSelection: DataExplorerField[],
                                 addedFields: DataExplorerField[],
                                 removedFields: DataExplorerField[],
                                 filterFunction: (field: DataExplorerField) => boolean): DataExplorerField[] {
    const fields = fieldSelection.filter(field => !(removedFields.find(rm => rm.fullDbName === field.fullDbName)));
    addedFields.forEach(field => {
      if (filterFunction(field)) {
        fields.push(field);
      }
    });
    return fields;
  }

  protected updateSingleField(fieldSelection: DataExplorerField,
                              availableFields: DataExplorerField[],
                              addedFields: DataExplorerField[],
                              removedFields: DataExplorerField[],
                              filterFunction: (field: DataExplorerField) => boolean): DataExplorerField {
    let result = fieldSelection;
    if (removedFields.find(rf => rf.fullDbName === fieldSelection.fullDbName)) {
      const existingFields = availableFields.concat(addedFields);
      if (existingFields.length > 0) {
        result = existingFields.find(field => filterFunction(field));
      }
    }

    return result;
  }

  public abstract refreshView();

  public abstract beforeDataFetched();

  public abstract onDataReceived(spQueryResult: SpQueryResult[]);

  public abstract onResize(width: number, height: number);

  protected abstract handleUpdatedFields(addedFields: DataExplorerField[], removedFields: DataExplorerField[]);

}
