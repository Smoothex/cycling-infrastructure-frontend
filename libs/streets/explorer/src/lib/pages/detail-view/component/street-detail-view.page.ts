import {
	ChangeDetectionStrategy,
	Component,
	effect,
	inject,
	input, resource,
	ViewEncapsulation,
} from '@angular/core';

import { StreetDetailViewFacade } from '@simra/streets-domain';
import { firstValueFrom } from 'rxjs';
import { IncidentListComponent } from '../../../components/incident-list/component/incident-list.component';
import {
	SafetyMetricsCardLogicComponent,
} from '../../../components/safety-metrics-card/component/safety-metrics-card-logic.component';
import { StreetInformationCardComponent } from '../../../components/street-information-card/component/street-information-card.component';

@Component({
	selector: 'p-street-detail-view',
	imports: [
    StreetInformationCardComponent,
    IncidentListComponent,
    SafetyMetricsCardLogicComponent
],
	templateUrl: './street-detail-view.page.html',
	styleUrl: './street-detail-view.page.scss',
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'p-street-detail-view',
	},
})
export class StreetDetailViewPage {
	private readonly _facade = inject(StreetDetailViewFacade);

	/**
	 * Automatically injected by activated route
	 */
	streetId = input<number>();

	streetInformation = resource({
		params: () => this.streetId(),
		loader: async ({ params }) => {
			if (!params) {
				return;
			}

			return await firstValueFrom(this._facade.getAndSetStreet(params));
		},
	})

	constructor() {
		effect(() => {
			this.streetInformation.value()
		});
	}
}
