import { ChangeDetectionStrategy, Component, inject, model, signal, ViewEncapsulation } from '@angular/core';

import { toSignal } from '@angular/core/rxjs-interop';
import { IPage } from '@simra/common-models';
import { ISafetyMetricsRequest } from '@simra/streets-common';
import { TableModule } from 'primeng/table';
import { firstValueFrom } from 'rxjs';
import { ISafetyMetrics } from '@simra/streets-common';
import { SimraRegionListViewFacade } from '@simra/regions-domain';
import { BaseRegionListViewComponent } from '../../../components/base-region-list-view/component/base-region-list-view.component';

@Component({
	selector: 't-simra-region-list-view',
	imports: [
    TableModule,
    BaseRegionListViewComponent
],
	templateUrl: './simra-region-list-view.page.html',
	styleUrl: './simra-region-list-view.page.scss',
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 't-simra-region-list-view',
	},
})
export class SimraRegionListViewPage {
	private readonly _facade = inject(SimraRegionListViewFacade);

	protected readonly loading = signal<boolean>(false);
	protected readonly _regions$ = model<IPage<ISafetyMetrics>>();
	protected readonly _lastRun$ = toSignal(this._facade.getLastRun('calculateSafetyMetricsSimraRegion'));

	async onFilter(event: ISafetyMetricsRequest) {
		this.loading.set(true);
		this._regions$.set(
			await firstValueFrom(this._facade.getSimraRegionListSafetyMetrics(event)),
		);
		this.loading.set(false);
	}
}
