import { Injectable, inject, computed } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { ChartColors } from '../../../models/chart-colors';
import { ChartOptions, Tick } from 'chart.js';

@Injectable({
	providedIn: 'root',
})
export class SafetyMetricsService {
	private readonly _translationService = inject(TranslateService);
	private readonly _langChange = toSignal(this._translationService.onLangChange)

	/**
	 * Options for the pie chart displaying the incident types
	 */
	public getPieMetricsIncidentTypesOptions = computed<ChartOptions>(() => {
		this._langChange();

		return {
			responsive: true,
			maintainAspectRatio: false,
			plugins: {
				title: {
					display: true,
					text: this._translationService.instant(
						'STREETS.EXPLORER.COMPONENTS.SAFETY_METRICS_PANEL.CHARTS.INCIDENT_TYPES.TITLE',
					),
					padding: {
						top: 5,
					},
				},
			},
			backgroundColor: ChartColors.INCIDENT_TYPES
		};
	});

	/**
	 * Options for the bar chart displaying the incident distribution
	 */
	public getBarMetricsRideIncidentDistributionOptions =  computed<ChartOptions> (() => {
		this._langChange();

		return {
			responsive: true,
			aspectRatio: 0.6,
			backgroundColor: ChartColors.RIDE_METRICS_DISTRIBUTION,
			plugins: {
				title: {
					display: true,
					text: this._translationService.instant(
						'STREETS.EXPLORER.COMPONENTS.SAFETY_METRICS_PANEL.CHARTS.RIDE_INCIDENT_DISTRIBUTION.TITLE',
					),
					padding: {
						top: 5,
						bottom: 20,
					},
				},
				legend: {
					display: false,
				},
			},
			scales: {
				y: {
					beginAtZero: true,
					ticks: {
						count: 11,
					},
				},
				right: {
					beginAtZero: true,
					position: 'right',
					ticks: {
						count: 11,
						// eslint-disable-next-line @typescript-eslint/no-unused-vars
						callback: (tickValue: number | string, _: number, __: Tick[]) => {
							return +tickValue * 100 + '%';
						},
					},
				},
			},
		}
	});
}
