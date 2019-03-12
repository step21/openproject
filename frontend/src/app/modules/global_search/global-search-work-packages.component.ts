// -- copyright
// OpenProject is a project management system.
// Copyright (C) 2012-2015 the OpenProject Foundation (OPF)
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License version 3.
//
// OpenProject is a fork of ChiliProject, which is a fork of Redmine. The copyright follows:
// Copyright (C) 2006-2013 Jean-Philippe Lang
// Copyright (C) 2010-2013 the ChiliProject Team
//
// This program is free software; you can redistribute it and/or
// modify it under the terms of the GNU General Public License
// as published by the Free Software Foundation; either version 2
// of the License, or (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program; if not, write to the Free Software
// Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
//
// See doc/COPYRIGHT.rdoc for more details.
// ++

import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener, Injector,
  OnDestroy,
  Renderer2,
  ViewChild
} from '@angular/core';
import {ContainHelpers} from 'app/modules/common/focus/contain-helpers';
import {FocusHelperService} from 'app/modules/common/focus/focus-helper';
import {I18nService} from 'app/modules/common/i18n/i18n.service';
import {DynamicBootstrapper} from "app/globals/dynamic-bootstrapper";
import {PathHelperService} from "app/modules/common/path-helper/path-helper.service";
import {HalResourceService} from "app/modules/hal/services/hal-resource.service";
import {WorkPackageResource} from "app/modules/hal/resources/work-package-resource";
import {CollectionResource} from "app/modules/hal/resources/collection-resource";
import {DynamicCssService} from "app/modules/common/dynamic-css/dynamic-css.service";
import {GlobalSearchService} from "app/modules/global_search/global-search.service";
import {debounceTime, distinctUntilChanged} from "rxjs/operators";
import {componentDestroyed, untilComponentDestroyed} from "ng2-rx-componentdestroyed";
import {CurrentProjectService} from "app/components/projects/current-project.service";
import {GlobalSearchInputComponent} from "app/modules/global_search/global-search-input.component";
import {combineLatest, Subscription} from "rxjs";
import {WorkPackageTableFilters} from "app/components/wp-fast-table/wp-table-filters";
import {WorkPackageTableFiltersService} from "app/components/wp-fast-table/state/wp-table-filters.service";
import {QueryFiltersComponent} from "app/components/filters/query-filters/query-filters.component";
import {WorkPackageEmbeddedTableComponent} from "app/components/wp-table/embedded/wp-embedded-table.component";
import {QueryResource} from "app/modules/hal/resources/query-resource";
import {QueryFormResource} from "app/modules/hal/resources/query-form-resource";
import {QueryFormDmService} from "app/modules/hal/dm-services/query-form-dm.service";
import {WorkPackageFiltersService} from "app/components/filters/wp-filters/wp-filters.service";
import {UrlParamsHelperService} from "app/components/wp-query/url-params-helper";

export const globalSearchWorkPackagesSelector = 'global-search-work-packages';

@Component({
  selector: globalSearchWorkPackagesSelector,
  templateUrl: '/app/components/wp-table/embedded/wp-embedded-table.html'
})

export class GlobalSearchWorkPackagesComponent extends WorkPackageEmbeddedTableComponent implements OnDestroy, AfterViewInit {
  @ViewChild('wpTable') wpTable:WorkPackageEmbeddedTableComponent;

  private query:QueryResource;
  private firstTimeLoadForm:boolean = false;

  public filters:WorkPackageTableFilters;
  public queryProps:{ [key:string]:any };

  constructor(readonly FocusHelper:FocusHelperService,
              readonly elementRef:ElementRef,
              readonly renderer:Renderer2,
              readonly I18n:I18nService,
              readonly halResourceService:HalResourceService,
              readonly globalSearchService:GlobalSearchService,
              readonly cdRef:ChangeDetectorRef,
              injector:Injector,
              private QueryFormDm:QueryFormDmService,
              private wpTableFilters:WorkPackageTableFiltersService,
              private UrlParamsHelper:UrlParamsHelperService,
              private WpFilter:WorkPackageFiltersService) {
    super(injector);
  }

  ngOnInit() {
    super.ngOnInit();

    this.configuration.actionsColumnEnabled = false;
    this.configuration.columnMenuEnabled = true;
    this.configuration.contextMenuEnabled = false;
    this.configuration.inlineCreateEnabled = false;
    this.configuration.withFilters = true;
    this.configuration.showFilterButton = true;
    this.configuration.filterButtonText = I18n.t('js.button_advanced_filter');

    combineLatest(
      this.globalSearchService.searchTerm$,
      this.globalSearchService.projectScope$
    )
    .pipe(
      distinctUntilChanged(),
      debounceTime(10),
      untilComponentDestroyed(this)
    )
    .subscribe(([newSearchTerm, newProjectScope]) => {
      this.WpFilter.visible = false;
      this.firstTimeLoadForm = true;
      this.setQueryProps();
    });

    this.globalSearchService
      .resultsHidden$
      .pipe(
        distinctUntilChanged(),
        untilComponentDestroyed(this)
      )
      .subscribe((resultsHidden:boolean) => this.show = !resultsHidden);

    this.setQueryProps(false);
  }

  public onFiltersChanged(filters:WorkPackageTableFilters) {
    if (filters.isComplete()) {
      this.query.filters = filters.current;
      this.queryProps = this.UrlParamsHelper.buildV3GetQueryFromQueryResource(this.query);
      this.refresh();
    }
  }

  protected loadQuery(visible:boolean = true) {
    return super.loadQuery(visible).then((query:QueryResource) => {
      if (this.firstTimeLoadForm) {
        this.firstTimeLoadForm = false;
        this.loadForm(query);
      }
      this.query = query;
      return query;
    });
  }

  private loadForm(query:QueryResource):Promise<QueryFormResource> {
    return this.QueryFormDm.load(query).then((form:QueryFormResource) => {
      this.wpStatesInitialization.updateStatesFromForm(query, form);
      return form;
    });
  }

  private setQueryProps(refresh:boolean = true):void {
    let filters:any[] = [];

    if (this.globalSearchService.searchTerm.length > 0) {
      filters.push({ search: {
          operator: '**',
          values: [this.globalSearchService.searchTerm] }});
    }

    if (this.globalSearchService.projectScope === 'current_project') {
      filters.push({ subprojectId: {
          operator: '!*',
          values: [] }});
    }

    if (this.globalSearchService.projectScope === '') {
      filters.push({ subprojectId: {
          operator: '*',
          values: [] }});
    }

    this.queryProps = {
      'columns[]': ['id', 'project', 'type', 'subject', 'updatedAt'],
      filters: JSON.stringify(filters),
      sortBy: JSON.stringify([['updatedAt', 'desc']]),
      showHierarchies: false
    };

    if (refresh) {
      this.refresh();
    }
  }

  ngOnDestroy():void {
    // Nothing to do.
  }
}

DynamicBootstrapper.register({
  selector: globalSearchWorkPackagesSelector, cls: GlobalSearchWorkPackagesComponent
});
