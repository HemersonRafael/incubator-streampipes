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

import { Component, OnInit } from '@angular/core';
import { BaseDataExplorerWidgetDirective } from '../base/base-data-explorer-widget.directive';
import { TimeSeriesChartWidgetModel } from './model/time-series-chart-widget.model';
import { DataExplorerField, SpQueryResult } from '@streampipes/platform-services';

@Component({
  selector: 'sp-data-explorer-time-series-chart-widget',
  templateUrl: './time-series-chart-widget.component.html',
  styleUrls: ['./time-series-chart-widget.component.scss']
})
export class TimeSeriesChartWidgetComponent extends BaseDataExplorerWidgetDirective<TimeSeriesChartWidgetModel> implements OnInit {

  presetColors: string[] = ['#39B54A', '#1B1464', '#f44336', '#4CAF50', '#FFEB3B', '#FFFFFF', '#000000'];

  groupKeeper: {} = {};

  data: any[] = undefined;
  advancedSettingsActive = false;
  showBackgroundColorProperty = true;

  selectedStartX = undefined;
  selectedEndX = undefined;
  n_selected_points = undefined;

  // this can be set to scale the line chart according to the layout
  offsetRightLineChart = 10;

  orderedSelectedProperties = [];

  maxValue = -10000000;

  updatemenus = [];
  graph = {

    layout: {
      font: {
        color: '#FFF',
        family: 'Roboto'
      },
      autosize: true,
      plot_bgcolor: '#fff',
      paper_bgcolor: '#fff',
      yaxis: {
        fixedrange: true
      },
      updatemenus: this.updatemenus,

      hovermode: 'x',
      showlegend: true,
      shapes: [],
      selectdirection: 'h',
      dragmode: 'zoom'
    },
    config: {
      modeBarButtonsToRemove: ['lasso2d', 'select2d', 'toggleSpikelines', 'toImage'],
      displaylogo: false
    }
  };

  ngOnInit(): void {
    this.updatemenus = [{
      buttons: [
        {
          args: ['mode', 'lines'],
          label: 'Line',
          method: 'restyle'
        },
        {
          args: ['mode', 'markers'],
          label: 'Dots',
          method: 'restyle'
        },

        {
          args: ['mode', 'lines+markers'],
          label: 'Dots + Lines',
          method: 'restyle'
        }
      ],
      direction: 'left',
      pad: { 'r': 10, 't': 10 },
      showactive: true,
      type: 'buttons',
      x: 0.0,
      xanchor: 'left',
      y: 1.3,
      yanchor: 'top',
      font: { color: this.dataExplorerWidget.baseAppearanceConfig.textColor },
      bgcolor: this.dataExplorerWidget.baseAppearanceConfig.backgroundColor,
      bordercolor: '#000'
    }];

    super.ngOnInit();
    this.resizeService.resizeSubject.subscribe(info => {
      if (info.gridsterItem.id === this.gridsterItem.id) {
        setTimeout(() => {
          this.graph.layout.autosize = false;
          (this.graph.layout as any).width = (info.gridsterItemComponent.width - this.offsetRightLineChart);
          (this.graph.layout as any).height = (info.gridsterItemComponent.height - 80);
        }, 100);
      }
    });
  }

  transformData(data: SpQueryResult,
                sourceIndex: number): any[] {

    const indexXkey = 0;

    const tmpLineChartTraces: any[] = [];

    data.allDataSeries.map((group, index) => {
      group.rows.forEach(row => {

        this.dataExplorerWidget.visualizationConfig.selectedTimeSeriesChartProperties.forEach(field => {
          if (field.sourceIndex === data.sourceIndex) {

            const columnIndex = this.getColumnIndex(field, data);
            const value = row[columnIndex];
            this.maxValue = value > this.maxValue ? value : this.maxValue;

            if (!this.orderedSelectedProperties.includes(field.fullDbName + field.sourceIndex.toString())) {
              this.orderedSelectedProperties.push(field.fullDbName + field.sourceIndex.toString());
            }
          }
        });
      });
    });

    data.allDataSeries.map((group, index) => {
      group.rows.forEach(row => {

        this.dataExplorerWidget.visualizationConfig.selectedTimeSeriesChartProperties.forEach(field => {
          if (field.sourceIndex === data.sourceIndex) {

            const name = field.fullDbName + sourceIndex.toString();

            if (group['tags'] != null) {
              Object.entries(group['tags']).forEach(
                ([key, val]) => {
                  if (name in this.groupKeeper) {
                    if (this.groupKeeper[name].indexOf(val) === - 1) {
                      this.groupKeeper[name].push(val);
                    }
                  } else {
                    this.groupKeeper[name] = [val];
                  }
                });
            }

            const columnIndex = this.getColumnIndex(field, data);

            let value = row[columnIndex];
            if (this.fieldProvider.booleanFields.find(f => field.fullDbName === f.fullDbName
              && f.sourceIndex === data.sourceIndex) !== undefined) {
              value = value === true ? this.maxValue + 2 : 0;
            }

            if (!(field.fullDbName + sourceIndex.toString() + index.toString() in tmpLineChartTraces)) {
              const headerName = data.headers[this.getColumnIndex(field, data)];
              tmpLineChartTraces[field.fullDbName + sourceIndex.toString() + index.toString()] = {
                type: 'scatter',
                mode: 'Line',
                name: headerName,
                connectgaps: false,
                x: [],
                y: []
              };
            }

            tmpLineChartTraces[field.fullDbName + sourceIndex.toString() + index.toString()].x.push(new Date(row[indexXkey]));
            tmpLineChartTraces[field.fullDbName + sourceIndex.toString() + index.toString()].y.push(value);
          }
        });
      });
    });

    return Object.values(tmpLineChartTraces);
  }

  lightenColor(color: string, percent: number) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    // tslint:disable-next-line:no-bitwise
    const R = (num >> 16) + amt;
    // tslint:disable-next-line:no-bitwise
    const B = (num >> 8 & 0x00FF) + amt;
    // tslint:disable-next-line:no-bitwise
    const G = (num & 0x0000FF) + amt;
    const result = '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
                  (B < 255 ? B < 1 ? 0 : B : 255) * 0x100 + (G < 255 ? G < 1 ? 0 : G : 255)).toString(16).slice(1);
    return result;
  }

  setStartX(startX: string) {
    this.selectedStartX = startX;
  }

  setEndX(endX: string) {
    this.selectedEndX = endX;
  }

  updateAppearance() {
    this.graph.layout.paper_bgcolor = this.dataExplorerWidget.baseAppearanceConfig.backgroundColor;
    this.graph.layout.plot_bgcolor = this.dataExplorerWidget.baseAppearanceConfig.backgroundColor;
    this.graph.layout.font.color = this.dataExplorerWidget.baseAppearanceConfig.textColor;

    if (this.dataExplorerWidget.visualizationConfig.showSpike) {
      this.graph.layout['xaxis'] = {
        type: 'date',
        showspikes: true,
        spikemode: 'across+toaxis',
        spikesnap: 'cursor',
        showline: true,
        showgrid: true,
        spikedash: 'dash',
        spikecolor: '#666666',
        spikethickness: 2,
      };
      this.graph.layout.hovermode = 'x';

    } else {
      this.graph.layout['xaxis'] = {
        type: 'date',
      };
      this.graph.layout.hovermode = '';
    }

    const colorKeeper = {};
    const dashTypeKeeper = {};
    const lineVisualizationOptions = ['solid', 'dash', 'dot', 'dashdot'];
    const barVisualizationOptions = ['', '+', '/', '.'];
    const symbolVisualizationOptions = ['diamond', 'star-triangle-up', 'pentagon', 'star-diamond', 'x'];
    const scatterVisualizationOptions = ['', 'diamond', 'star-triangle-up', 'pentagon', 'star-diamond', 'x'];

    let pastGroups = 0;
    let index = 0;

    const collectNames = [];

    if (this.data) {
      this.orderedSelectedProperties.map((name, findex) => {

        collectNames.push(name);

        let localGroups = [];
        if (name in this.groupKeeper) {
          localGroups = this.groupKeeper[name];
        }

        let repeat = 1;
        if (localGroups.length > 0) {
          repeat = localGroups.length;
        }

        for (let it = 0; it < repeat; it++) {

          index = pastGroups;

          if (this.data[index] !== undefined) {
            this.data[index]['marker'] = { 'color': '' };

            if (!(name in this.dataExplorerWidget.visualizationConfig.chosenColor)) {
              this.dataExplorerWidget.visualizationConfig.chosenColor[name] = this.presetColors[index];
            }

            if (!(name in this.dataExplorerWidget.visualizationConfig.displayName)) {
              this.dataExplorerWidget.visualizationConfig.displayName[name] = name;
            }

            if (!(name in this.dataExplorerWidget.visualizationConfig.displayType)) {
              this.dataExplorerWidget.visualizationConfig.displayType[name] = 'lines';
            }

            if (!(name in this.dataExplorerWidget.visualizationConfig.chosenAxis)) {
              this.dataExplorerWidget.visualizationConfig.chosenAxis[name] = 'left';
            } else {
            }

            let color = this.dataExplorerWidget.visualizationConfig.chosenColor[name];
            const setType = this.dataExplorerWidget.visualizationConfig.displayType[name];

            let visualizationOptions;
            if (setType === 'bar') {
              visualizationOptions = barVisualizationOptions;
            }
            if (setType === 'lines' || setType === 'lines+markers')  {
              visualizationOptions = lineVisualizationOptions;
            }
            if (setType === 'symbol_markers') {
              visualizationOptions = symbolVisualizationOptions;
            }
            if (setType === 'normal_markers') {
              visualizationOptions = scatterVisualizationOptions;
            }

            let dashType;

            if (name in colorKeeper) {
              dashType = dashTypeKeeper[name];
              const visualizationTypePosition = visualizationOptions.indexOf(dashType);
              if (visualizationTypePosition === (visualizationOptions.length - 1)) {
                dashType = visualizationOptions[0];
                dashTypeKeeper[name] = dashType;
                color = this.lightenColor(colorKeeper[name], 11.0);
                colorKeeper[name] = color;
              } else {
                dashType = visualizationOptions[visualizationTypePosition + 1];
                dashTypeKeeper[name] = dashType;
                color = colorKeeper[name];
              }

            } else {
              dashType = visualizationOptions[0];
              dashTypeKeeper[name] = dashType;
              colorKeeper[name] = color;
            }

            let displayName = this.dataExplorerWidget.visualizationConfig.displayName[name];
            if (localGroups.length > 0) {
              const tag = localGroups[it];
              displayName = displayName + ' ' + tag;
            }

            this.data[index].marker.color = color;

            if (setType === 'bar') {
              this.data[index].marker['pattern'] = {
                  'shape' : dashType,
                  'fillmode' : 'overlay',
                  'fgcolor' : '#ffffff',
                  // 'size' : 3,
              };
            } else {
              if (setType === 'lines' || setType === 'lines+markers') {
                this.data[index]['line'] = {
                              'dash' : dashType,
                              'width' : 3,
                };
              }
            }

            this.data[index].name = displayName;

            let displayType = 'scatter';
            let displayMode = 'lines';

            if (setType === 'bar') {
              displayType = 'bar';
            }
            if (setType === 'lines') {
              displayMode = 'lines';
            }
            if (setType === 'lines+markers') {
              displayMode = 'lines+markers';
            }
            if (setType === 'normal_markers') {
              displayMode = 'markers';
              this.data[index].marker['symbol'] = dashType;
              this.data[index].marker['size'] = 5;
            }
            if (setType === 'symbol_markers') {
              displayMode = 'markers';
              this.data[index].marker['symbol'] = dashType;
              this.data[index].marker['size'] = 10;
            }

            this.data[index].type = displayType;
            this.data[index].mode = displayMode;

            const setAxis = this.dataExplorerWidget.visualizationConfig.chosenAxis[name] === 'left' ? 'y1' : 'y2';
            this.data[index]['yaxis'] = setAxis;

            if (setAxis === 'y2') {
              this.graph.layout['yaxis2'] = {
                                              title: '',
                                              overlaying: 'y',
                                              side: 'right'
                                            };
            }

            pastGroups += 1;
          }
        }
      });
    }
  }

  refreshView() {
    this.updateAppearance();
  }

  onResize(width: number, height: number) {
    this.graph.layout.autosize = false;
    (this.graph.layout as any).width = width;
    (this.graph.layout as any).height = height;
  }

  beforeDataFetched() {
    this.graph.layout.shapes = [];
    this.setShownComponents(false, false, true, false);
  }

  onDataReceived(spQueryResults: SpQueryResult[]) {
    this.data = [];

      // this.setShownComponents(true, false, false, false);
      this.groupKeeper = {};

      this.orderedSelectedProperties = [];

      spQueryResults.map((spQueryResult, index) => {
        const res = this.transformData(spQueryResult, spQueryResult.sourceIndex);
        res.forEach(item => {
          this.data = this.data.concat(item);
        });
      });

      this.setShownComponents(false, true, false, false);

  }

  handleUpdatedFields(addedFields: DataExplorerField[],
                      removedFields: DataExplorerField[]) {
    this.dataExplorerWidget.visualizationConfig.selectedTimeSeriesChartProperties =
      this.updateFieldSelection(
        this.dataExplorerWidget.visualizationConfig.selectedTimeSeriesChartProperties,
        addedFields,
        removedFields,
        (field) => field.fieldCharacteristics.numeric
      );
  }
}
