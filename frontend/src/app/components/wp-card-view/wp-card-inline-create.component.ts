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
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Inject,
  Injector,
  Input,
  OnDestroy,
  OnInit
} from '@angular/core';
import {AuthorisationService} from 'core-app/modules/common/model-auth/model-auth.service';
import {WorkPackageTableFocusService} from 'core-components/wp-fast-table/state/wp-table-focus.service';
import {WorkPackageResource} from 'core-app/modules/hal/resources/work-package-resource';
import {WorkPackageChangeset} from '../wp-edit-form/work-package-changeset';
import {WorkPackageTableColumnsService} from '../wp-fast-table/state/wp-table-columns.service';
import {IsolatedQuerySpace} from "core-app/modules/work_packages/query-space/isolated-query-space";
import {componentDestroyed, untilComponentDestroyed} from 'ng2-rx-componentdestroyed';
import {I18nService} from 'core-app/modules/common/i18n/i18n.service';
import {FocusHelperService} from 'core-app/modules/common/focus/focus-helper';
import {IWorkPackageCreateServiceToken} from "core-components/wp-new/wp-create.service.interface";
import {WorkPackageInlineCreateService} from "core-components/wp-inline-create/wp-inline-create.service";
import {WorkPackageCreateService} from "core-components/wp-new/wp-create.service";
import {WorkPackageCardViewComponent} from "core-components/wp-card-view/wp-card-view.component";
import {ReorderQueryService} from "core-app/modules/boards/drag-and-drop/reorder-query.service";
import {CurrentProjectService} from "core-components/projects/current-project.service";
import {Subject} from "rxjs";
import {WorkPackageCacheService} from "core-components/work-packages/work-package-cache.service";

@Component({
  selector: 'wp-card-inline-create',
  templateUrl: './wp-card-inline-create.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkPackageCardViewInlineCreateComponent implements OnInit, OnDestroy {

  @Input() onCardRemoved:Subject<undefined>;

  // Inline create / reference row is active
  public mode:'inactive'|'create'|'reference' = 'inactive';

  public text = {
    addNewCard:  this.I18n.t('js.card.add_new'),
    addExisting:  this.I18n.t('js.relation_buttons.add_existing'),
  };

  public canAdd = false;
  public canReference = false;

  // We need to mount a dynamic component into the view
  // but map the following output
  public referenceOutputs = {
    onCancel: () => this.reset(),
    onReferenced: (wp:WorkPackageResource) => this.addWorkPackageToQuery(wp)
  };

  constructor(public readonly injector:Injector,
              protected readonly elementRef:ElementRef,
              protected readonly FocusHelper:FocusHelperService,
              protected readonly I18n:I18nService,
              protected readonly querySpace:IsolatedQuerySpace,
              protected readonly currentProject:CurrentProjectService,
              protected readonly cardView:WorkPackageCardViewComponent,
              protected readonly reorderService:ReorderQueryService,
              @Inject(IWorkPackageCreateServiceToken) protected readonly wpCreate:WorkPackageCreateService,
              protected readonly wpInlineCreate:WorkPackageInlineCreateService,
              protected readonly wpTableColumns:WorkPackageTableColumnsService,
              protected readonly wpTableFocus:WorkPackageTableFocusService,
              protected readonly wpCacheService:WorkPackageCacheService,
              protected readonly cdRef:ChangeDetectorRef,
              protected readonly authorisationService:AuthorisationService) {
  }

  ngOnDestroy() {
    // Compliance
    console.error("WAT");
  }

  ngOnInit() {
    this.registerCreationCallback();

    // Update permission on model updates
    this.authorisationService
      .observeUntil(componentDestroyed(this))
      .subscribe(() => {
        this.canAdd = this.wpInlineCreate.canAdd;
        this.canReference = this.wpInlineCreate.canReference;
        this.cdRef.detectChanges();
      });

    // Reset mode when card is removed from array
    this.onCardRemoved
      .pipe(
        untilComponentDestroyed(this)
      )
      .subscribe(() => this.reset());
  }

  /**
   * Listen to newly created work packages to detect whether the WP is the one we created,
   * and properly reset inline create in this case
   */
  private registerCreationCallback() {
    this.wpCreate
      .onNewWorkPackage()
      .pipe(untilComponentDestroyed(this))
      .subscribe(async (wp:WorkPackageResource) => {
        this.cardView.onCardSaved(wp);
      });
  }

  public reset() {
    this.mode = 'inactive';
    this.cdRef.detectChanges();
  }

  public handleCreateClick() {
    this.mode = 'create';
    this.addWorkPackageCard();
    return false;
  }

  public handleReferenceClick() {
    this.mode = 'reference';
    return false;
  }

  public get referenceClass() {
    return this.wpInlineCreate.referenceComponentClass;
  }

  public get hasReferenceClass() {
    return !!this.referenceClass;
  }

  public addWorkPackageToQuery(wp:WorkPackageResource) {
    this.cardView.addWorkPackageToQuery(wp);
  }

  public addWorkPackageCard() {
    this.wpCreate
      .createOrContinueWorkPackage(this.currentProject.identifier)
      .then((changeset:WorkPackageChangeset) => {
        this.cardView.addNewCard(changeset.workPackage);
      });
  }
}
