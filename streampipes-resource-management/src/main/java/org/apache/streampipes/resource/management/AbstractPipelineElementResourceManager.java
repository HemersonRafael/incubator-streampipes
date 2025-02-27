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
package org.apache.streampipes.resource.management;

import org.apache.streampipes.model.base.AbstractStreamPipesEntity;
import org.apache.streampipes.model.base.NamedStreamPipesEntity;
import org.apache.streampipes.model.client.user.Permission;
import org.apache.streampipes.storage.api.CRUDStorage;

import java.util.List;
import java.util.stream.Collectors;

public abstract class AbstractPipelineElementResourceManager<T extends CRUDStorage<String, D>, D extends NamedStreamPipesEntity, I> extends AbstractResourceManager<T> {

  public AbstractPipelineElementResourceManager(T db) {
    super(db);
  }

  public List<D> findAll() {
    return db.getAll();
  }

  public List<String> findAllIdsOnly() {
    return db.getAll().stream().map(AbstractStreamPipesEntity::getElementId).collect(Collectors.toList());
  }

  public List<I> findAllAsInvocation() {
    return findAll()
            .stream()
            .map(this::toInvocation)
            .collect(Collectors.toList());
  }

  public D find(String elementId) {
    return db.getElementById(elementId);
  }

  public I findAsInvocation(String elementId) {
    return toInvocation(find(elementId));
  }

  public void delete(String elementId) {
    D description = find(elementId);
    deleteAssetsAndPermissions(description);
    db.deleteElement(description);
  }

  private void deleteAssetsAndPermissions(D description) {
    SpResourceManager manager = new SpResourceManager();
    List<Permission> permissions = manager.managePermissions().findForObjectId(description.getElementId());
    permissions.forEach(permission -> manager.managePermissions().delete(permission));
  }

  protected abstract I toInvocation(D description);
}
