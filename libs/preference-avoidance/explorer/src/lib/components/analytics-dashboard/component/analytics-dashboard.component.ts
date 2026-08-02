import { DatePipe, DecimalPipe } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	input,
	output,
	resource,
	signal,
	ViewEncapsulation,
} from '@angular/core';
import {
	AnalyticsContext,
	AnalyticsFilters,
	CorridorRanking,
	InfrastructureDimension,
	InfrastructureSignals,
} from '@simra/preference-avoidance-common';
import { PreferenceAvoidanceAnalysisFacade } from '@simra/preference-avoidance-domain';
import { ChartData, ChartOptions } from 'chart.js';
import { Card } from 'primeng/card';
import { UIChart } from 'primeng/chart';
import { Skeleton } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { firstValueFrom } from 'rxjs';

// The backend caps corridor ranking results at 50; fetch the full cap once and
// page through it client-side rather than re-fetching per page.
const corridorLimit = 50;
const corridorPageSize = 8;
const corridorMinRideCount = 5;
const infrastructureLimit = 10;
const infrastructureMinRideCount = 20;
const avoidanceColor = '#dc2626';
const preferenceColor = '#16a34a';

@Component({
	selector: 't-analytics-dashboard',
	standalone: true,
	imports: [Card, UIChart, Skeleton, TableModule, DecimalPipe, DatePipe],
	templateUrl: './analytics-dashboard.component.html',
	styleUrl: './analytics-dashboard.component.scss',
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 't-analytics-dashboard' },
})
export class AnalyticsDashboardComponent {
	private readonly _facade = inject(PreferenceAvoidanceAnalysisFacade);

	public readonly filters = input.required<AnalyticsFilters>();
	public readonly viewCorridorOnMap = output<CorridorRanking>();

	protected readonly corridorPageSize = corridorPageSize;

	protected readonly selectedInfrastructureDimension = signal<InfrastructureDimension>('SURFACE');
	protected readonly infrastructureDimensionOptions: { label: string; value: InfrastructureDimension }[] = [
		{ label: 'Surface', value: 'SURFACE' },
		{ label: 'Smoothness', value: 'SMOOTHNESS' },
		{ label: 'Cycleway', value: 'CYCLEWAY_TYPE' },
		{ label: 'Road class', value: 'HIGHWAY' },
	];

	private readonly filtersKey = computed(() => {
		const filters = this.filters();
		return [filters.from ?? '', filters.to ?? '', filters.rideIntent ?? ''].join('|');
	});

	protected readonly context = resource<AnalyticsContext | undefined, string>({
		params: () => this.filtersKey(),
		loader: async () => firstValueFrom(this._facade.getAnalyticsContext(this.filters())),
	});

	protected readonly topAvoidedCorridors = resource<CorridorRanking[], string>({
		params: () => this.filtersKey(),
		defaultValue: [],
		loader: async () => firstValueFrom(this._facade.getCorridors({
			rank: 'AVOIDANCE',
			limit: corridorLimit,
			minRideCount: corridorMinRideCount,
			...this.filters(),
		})),
	});

	protected readonly topPreferredCorridors = resource<CorridorRanking[], string>({
		params: () => this.filtersKey(),
		defaultValue: [],
		loader: async () => firstValueFrom(this._facade.getCorridors({
			rank: 'PREFERENCE',
			limit: corridorLimit,
			minRideCount: corridorMinRideCount,
			...this.filters(),
		})),
	});

	protected readonly infrastructureSignals = resource<InfrastructureSignals | undefined, string>({
		params: () => `${this.filtersKey()}|${this.selectedInfrastructureDimension()}`,
		loader: async () => firstValueFrom(this._facade.getInfrastructureSignals({
			dimension: this.selectedInfrastructureDimension(),
			limit: infrastructureLimit,
			minRideCount: infrastructureMinRideCount,
			...this.filters(),
		})),
	});

	protected readonly infrastructureChartData = computed<ChartData<'bar'>>(() => {
		const buckets = this.infrastructureSignals.value()?.buckets ?? [];
		return {
			labels: buckets.map((bucket) => `${this.formatBucketValue(bucket.value)} (n=${bucket.totalRideSignals.toLocaleString('en')})`),
			datasets: [{
				label: 'Difference from baseline',
				data: buckets.map((bucket) => Math.round((bucket.percentagePointDifference ?? 0) * 10) / 10),
				backgroundColor: buckets.map((bucket) =>
					(bucket.percentagePointDifference ?? 0) >= 0 ? avoidanceColor : preferenceColor),
			}],
		};
	});

	protected readonly infrastructureChartOptions: ChartOptions<'bar'> = {
		responsive: true,
		maintainAspectRatio: false,
		indexAxis: 'y',
		plugins: { legend: { display: false } },
		scales: {
			x: {
				title: { display: true, text: 'Difference from baseline (percentage points)' },
				grid: { color: (context) => context.tick.value === 0 ? '#64748b' : 'rgba(148, 163, 184, 0.2)' },
			},
		},
	};

	protected readonly coverageNote = computed(() => {
		const result = this.infrastructureSignals.value();
		if (!result) {
			return undefined;
		}
		const coverage = result.coverageShare == null ? '0%' : `${(result.coverageShare * 100).toFixed(0)}%`;
		const baseline = result.baselineAvoidanceShare == null
			? 'unavailable'
			: `${(result.baselineAvoidanceShare * 100).toFixed(1)}% avoidance signals`;
		return `${result.knownAttributeEventCount.toLocaleString('en')} matching observations have a known attribute (${coverage} coverage). Baseline: ${baseline}.`;
	});

	protected onInfrastructureDimensionChange(dimension: InfrastructureDimension): void {
		this.selectedInfrastructureDimension.set(dimension);
	}

	protected signalShare(corridor: CorridorRanking, type: 'AVOIDANCE' | 'PREFERENCE'): number {
		const total = corridor.avoidanceRideCount + corridor.preferenceRideCount;
		if (!total) {
			return 0;
		}
		const count = type === 'AVOIDANCE' ? corridor.avoidanceRideCount : corridor.preferenceRideCount;
		return count / total * 100;
	}

	protected formatBucketValue(value: string): string {
		return value
			.toLowerCase()
			.split(/[_:]/)
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}
}
