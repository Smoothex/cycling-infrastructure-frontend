import { CommonModule } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	model,
	ModelSignal,
	ViewEncapsulation,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Store } from '@ngxs/store';
import { EnumSelectButtonComponent, SafetyMetricsCardComponent, CARD_MODE_TO_TRANSLATION_MAP } from '@simra/common-components';
import { ETrafficTimes, EWeekDays, EYear } from '@simra/common-models';
import {
	SetSelectedIncidents,
	SetSelectedSafetyMetrics,
	StreetDetailState, StreetDetailViewFacade,
} from '@simra/streets-domain';
import { find, first, last } from 'lodash';
import { firstValueFrom } from 'rxjs';
import { SafetyMetricsService } from '../../../services/safety-metrics.service';
import { StreetAnalyticsService } from '../../../services/street-analytics.service';
import { ECardMode } from '../models/card-mode.enum';

@Component({
	selector: 't-safety-metrics-card-logic',
	imports: [
		CommonModule,
		SafetyMetricsCardComponent,
		FormsModule,
		EnumSelectButtonComponent
	],
	templateUrl: './safety-metrics-card-logic.component.html',
	styleUrl: './safety-metrics-card-logic.component.scss',
	host: {
		class: 'm-safety-metrics-panel',
	},
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SafetyMetricsCardLogicComponent {
	private readonly _safetyMetricsService = inject(SafetyMetricsService);
	private readonly _store = inject(Store);
	private readonly _analyticsService = inject(StreetAnalyticsService);
	private readonly _streetDetailViewFacade = inject(StreetDetailViewFacade);

	protected readonly _lastRun$ = toSignal(
		this._streetDetailViewFacade.fetchLastMethodRun('updateSafetyMetrics'),
	);
	protected _mode$: ModelSignal<ECardMode> = model<ECardMode>(ECardMode.PRECOMPUTED);
	protected readonly _datetime$ = model<Date[]>([new Date('2019-01-01T00:00'), new Date()]);
	protected readonly _parsedDatetime$ = computed(() => {
		const datetime = this._datetime$();
		if (!datetime || datetime.length !== 2) {
			return;
		}

		return datetime.map((date) => new Date(date));
	});

	protected readonly _selectedYear = model<EYear>(EYear.ALL);
	protected readonly _selectedWeekDays = model<EWeekDays[]>([EWeekDays.WEEK, EWeekDays.WEEKEND]);
	protected readonly _selectedTrafficTime = model<ETrafficTimes>(ETrafficTimes.ALL_DAY);

	protected readonly _street$ = this._store.selectSignal(StreetDetailState.getStreet);
	protected readonly _selectedSafetyMetrics$ = this._store.selectSignal(
		StreetDetailState.getSelectedSafetyMetrics,
	);
	protected readonly _pieMetricsIncidentTypesData$ =
		this._safetyMetricsService.pieMetricsIncidentTypesData$;
	protected readonly _barMetricsRideIncidentDistributionData$ =
		this._safetyMetricsService.barMetricsRideIncidentDistributionData$;

	protected startTime = model<Date>(new Date('1970-01-01T00:00:00'));
	protected endTime = model<Date>(new Date('1970-01-01T23:59'));

	constructor() {
		effect(async () => {
			const mode = this._mode$();
			const street = this._street$();

			if (street && mode === ECardMode.PRECOMPUTED) {
				const selectedWeekDays = this._selectedWeekDays();
				const selectedYear = this._selectedYear();
				const selectedWeekDay =
					selectedWeekDays.length === 1 ? first(selectedWeekDays) : EWeekDays.ALL_WEEK;

				const selectedTrafficTimes = this._selectedTrafficTime();

				const selectedMetrics = find(street.safetyMetricPlanetOsmLines, (metrics) => {
					return (
						metrics.weekDay === selectedWeekDay &&
						metrics.trafficTime === selectedTrafficTimes &&
						metrics.year == selectedYear
					);
				});

				const incidents = street.rideIncident?.filter((incident) => {
					return (
						(incident.trafficTime === selectedTrafficTimes ||
							selectedTrafficTimes === ETrafficTimes.ALL_DAY) &&
						(incident.weekDay === selectedWeekDay ||
							selectedWeekDay === EWeekDays.ALL_WEEK)
					);
				});

				this._store.dispatch(new SetSelectedIncidents(incidents));
				this._store.dispatch(new SetSelectedSafetyMetrics(selectedMetrics));
			}

			if (mode === ECardMode.REALTIME) {
				const datetime = this._parsedDatetime$();
				const startTime = this.startTime();
				const endTime = this.endTime();

				if (!datetime || !startTime || !endTime) {
					return;
				}
				await firstValueFrom(
					this._analyticsService.calculateSafetyMetrics(
						first(datetime),
						last(datetime),
						startTime,
						endTime,
					),
				);
			}
		});
	}

	protected readonly CARD_MODE_TO_TRANSLATION_MAP = CARD_MODE_TO_TRANSLATION_MAP;
	protected readonly ECardMode = ECardMode;
}
