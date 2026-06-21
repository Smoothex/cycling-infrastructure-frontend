
import {
	ChangeDetectionStrategy,
	Component,
	inject,
	model,
	signal,
	ViewEncapsulation,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { TTranslationMap } from '@simra/common-components';

import { IPage } from '@simra/common-models';
import { transformMapToList } from '@simra/common-utils';
import { RegionListViewFacade } from '@simra/regions-domain';
import { ISafetyMetrics, ISafetyMetricsRequest } from '@simra/streets-common';
import { Select } from 'primeng/select';
import { TableModule } from 'primeng/table';
import { firstValueFrom } from 'rxjs';
import { BaseRegionListViewComponent } from '../../../components/base-region-list-view/component/base-region-list-view.component';
import { AdminLevelTranslationMap } from '../models/admin-level-translation.map';
import { EAdminLevel } from '../models/admin-level.enum';

@Component({
	selector: 't-region-list-view',
	imports: [
    TableModule,
    BaseRegionListViewComponent,
    Select,
    FormsModule,
    TranslatePipe
],
	templateUrl: './region-list-view.page.html',
	styleUrl: './region-list-view.page.scss',
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 't-region-list-view',
	},
})
export class RegionListViewPage {
	private readonly _facade = inject(RegionListViewFacade);

	protected readonly loading = signal<boolean>(false);
	protected readonly _regions$ = model<IPage<ISafetyMetrics>>();
	protected readonly _lastRun = toSignal(this._facade.getLastRun('SafetyMetricsService->updateSafetyMetrics'));

	protected selectedAdminLevel = model<({key: string} & TTranslationMap<EAdminLevel>)>();
	protected filterRequestParam = signal<ISafetyMetricsRequest>({});

	async onFilter(event: ISafetyMetricsRequest) {
		this.loading.set(true);

		if (event) {
			this.filterRequestParam.set(event);
		}
		const requestWithAdminLevel = {
			...this.filterRequestParam(),
			adminLevel: this.selectedAdminLevel()?.key,
		};

		this._regions$.set(
			await firstValueFrom(this._facade.getRegionListSafetyMetrics(requestWithAdminLevel)),
		);
		this.loading.set(false);
	}

	protected readonly AdminLevelTranslationMap = AdminLevelTranslationMap;
	protected readonly transformMapToList = transformMapToList;
}
