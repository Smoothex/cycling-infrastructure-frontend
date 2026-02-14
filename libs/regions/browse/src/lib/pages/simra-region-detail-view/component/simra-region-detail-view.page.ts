import { CommonModule } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	inject, input,
	model,
	resource, signal,
	ViewEncapsulation,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { IMapPosition, ISafetyMetricsRegion } from '@simra/common-models';
import { find } from 'lodash';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ButtonDirective } from 'primeng/button';
import { Skeleton } from 'primeng/skeleton';
import { firstValueFrom } from 'rxjs';
import { SimraRegionDetailViewFacade } from '@simra/regions-domain';
import { BaseRegionDetailViewComponent } from '../../../components/base-region-detail-view/component/base-region-detail-view.component';
import { IDetailViewChange } from '../../../components/base-region-detail-view/models/interfaces/detail-view-change.interface';
import { SafetyMetricsService } from '../../../services/safety-metrics.service';

@Component({
	selector: 'p-region-detail-view',
	imports: [
		CommonModule,
		AutoCompleteModule,
		FormsModule,
		BaseRegionDetailViewComponent,
		RouterLink,
		ButtonDirective,
		TranslatePipe,
		Skeleton,
	],
	templateUrl: './simra-region-detail-view.page.html',
	styleUrl: './simra-region-detail-view.page.scss',
	host: {
		class: 't-simra-region-detail-view',
	},
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SimraRegionDetailViewPage {
	private readonly _facade = inject(SimraRegionDetailViewFacade);
	private readonly _metricsService = inject(SafetyMetricsService);
	protected readonly regionName = input<string>();

	protected readonly _safetyMetrics = signal<ISafetyMetricsRegion>(undefined);
	protected readonly _detailedRegion = resource({
		request: () => this.regionName(),
		loader: async ({ request }) => {
			if (!request) {
				return;
			}

			return await firstValueFrom(this._facade.getSimraDetailedRegion(request));
		},
	});
	protected readonly _queryOptions = model<IMapPosition>();
	protected readonly _profileSafetyMetrics$ = resource({
		request: () => this.regionName(),
		loader: async ({ request }) => {
			return await firstValueFrom(this._facade.getSimraProfileSafetyMetrics(request));
		},
	});

	protected readonly _lastRunSimraRegionMetrics$ = toSignal(this._facade.getLastMethodRun('SafetyMetricsService->updateSafetyMetrics'));
	protected readonly _lastRunProfileMetrics$ = toSignal(this._facade.getLastMethodRun('SafetyMetricsService->updateSafetyMetrics'));

	async changeDetails(event: IDetailViewChange) {
		const regionName = this.regionName();
		if (!event || !event.year || !event.weekDay || !event.trafficTime || !regionName) {
			return;
		}

		const safetyMetrics = await firstValueFrom(
			this._facade.getSimraRegionSafetyMetrics(regionName),
		);

		this._metricsService.safetyMetrics$.set(safetyMetrics);

		const signaleSafetyMetrics = find(safetyMetrics, (metrics) => {
			return (
				metrics.weekDay === event.weekDay &&
				metrics.trafficTime === event.trafficTime &&
				metrics.year === event.year
			);
		});
		this._safetyMetrics.set(signaleSafetyMetrics);
	}
}
