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
	DetourImpactRouteComparisonType,
	InfrastructureDimension,
	InfrastructureSignals,
	RouteComparisonDetourImpact,
	RouteComparisonSummary,
	RouteComparisonType,
} from '@simra/preference-avoidance-common';
import { PreferenceAvoidanceAnalysisFacade } from '@simra/preference-avoidance-domain';
import { BoxAndWiskers, BoxPlotController } from '@sgratzl/chartjs-chart-boxplot';
import { Chart, ChartData, ChartOptions, TooltipItem } from 'chart.js';
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
const minimumDetourImpactSampleSize = 10;
const routeComparisonTypes: {
	type: RouteComparisonType;
	label: string;
	color: string;
}[] = [
	{ type: 'EQUIVALENT_ROUTE', label: 'Equivalent route', color: '#2563eb' },
	{ type: 'LOCAL_DETOUR', label: 'Local detour', color: '#d97706' },
	{ type: 'CORRIDOR_ALTERNATIVE', label: 'Corridor alternative', color: '#7c3aed' },
];
const detourImpactTypes: {
	type: DetourImpactRouteComparisonType;
	label: string;
	color: string;
}[] = routeComparisonTypes.filter(
	(item): item is typeof item & { type: DetourImpactRouteComparisonType } =>
		item.type !== 'EQUIVALENT_ROUTE',
);

Chart.register(BoxPlotController, BoxAndWiskers);

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
	// PrimeNG's input type does not include chart types added through Chart.js extensions.
	protected readonly detourImpactChartType = 'boxplot' as never;

	protected readonly selectedInfrastructureDimension = signal<InfrastructureDimension>('SURFACE');
	protected readonly infrastructureDimensionOptions: {
		label: string;
		value: InfrastructureDimension;
	}[] = [
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

	protected readonly routeComparisons = resource<RouteComparisonSummary | undefined, string>({
		params: () => this.filtersKey(),
		loader: async () => firstValueFrom(this._facade.getRouteComparisons(this.filters())),
	});

	protected readonly routeComparisonChartData = computed<ChartData<'doughnut'>>(() => {
		const counts = this.routeComparisons.value()?.routeComparisonTypeCounts;
		return {
			labels: routeComparisonTypes.map(({ label }) => label),
			datasets: [
				{
					data: routeComparisonTypes.map(({ type }) => counts?.[type] ?? 0),
					backgroundColor: routeComparisonTypes.map(({ color }) => color),
					borderWidth: 0,
				},
			],
		};
	});

	protected readonly routeComparisonChartOptions: ChartOptions<'doughnut'> = {
		responsive: true,
		maintainAspectRatio: false,
		cutout: '62%',
		plugins: {
			legend: { display: false },
			tooltip: {
				callbacks: {
					label: (context) =>
						`${context.label}: ${Number(context.raw).toLocaleString('en')}`,
				},
			},
		},
	};

	protected readonly routeComparisonLegendItems = computed(() => {
		const counts = this.routeComparisons.value()?.routeComparisonTypeCounts;
		return routeComparisonTypes.map((item) => ({
			...item,
			count: counts?.[item.type] ?? 0,
		}));
	});

	protected readonly eligibleDetourImpact = computed(() => {
		const impact = this.routeComparisons.value()?.detourImpact ?? [];
		return detourImpactTypes.flatMap((definition) => {
			const entry = impact.find((item) => item.routeComparisonType === definition.type);
			return entry && entry.eligibleRideCount >= minimumDetourImpactSampleSize
				? [{ ...definition, ...entry }]
				: [];
		});
	});

	protected readonly omittedDetourImpactLabel = computed(() => {
		if (this.eligibleDetourImpact().length !== 1) {
			return undefined;
		}
		const plottedType = this.eligibleDetourImpact()[0].routeComparisonType;
		return detourImpactTypes.find(({ type }) => type !== plottedType)?.label;
	});

	protected readonly detourImpactChartData = computed<ChartData<'boxplot'>>(() => {
		const impact = this.eligibleDetourImpact();
		return {
			labels: impact.map(({ label }) => label),
			datasets: [
				{
					label: 'Middle 50% extra distance',
					data: impact.map((item) => ({
						min: item.lowerQuartilePercent,
						q1: item.lowerQuartilePercent,
						median: item.medianPercent,
						q3: item.upperQuartilePercent,
						max: item.upperQuartilePercent,
					})),
					backgroundColor: impact.map(({ color }) => `${color}cc`),
					borderColor: impact.map(({ color }) => color),
					borderWidth: 1,
					medianColor: '#111827',
					outlierRadius: 0,
					meanRadius: 0,
				},
			],
		};
	});

	protected readonly detourImpactChartOptions: ChartOptions<'boxplot'> = {
		responsive: true,
		maintainAspectRatio: false,
		indexAxis: 'y',
		plugins: {
			legend: { display: false },
			annotation: {
				annotations: {
					detourThreshold: {
						type: 'line',
						xMin: 10,
						xMax: 10,
						borderColor: '#64748b',
						borderDash: [5, 5],
						borderWidth: 1.5,
						label: {
							display: true,
							content: '10% boundary',
							position: 'end',
							backgroundColor: 'rgba(100, 116, 139, 0.88)',
							font: { size: 10 },
						},
					},
				},
			},
			tooltip: {
				callbacks: {
					label: (context) => this.detourImpactTooltip(context),
				},
			},
		},
		scales: {
			x: {
				suggestedMin: 0,
				title: { display: true, text: 'Extra distance compared with shortest path' },
				ticks: { callback: (value) => this.formatSignedPercent(Number(value)) },
				grid: { color: 'rgba(148, 163, 184, 0.2)' },
			},
			y: { grid: { display: false } },
		},
	};

	protected readonly topAvoidedCorridors = resource<CorridorRanking[], string>({
		params: () => this.filtersKey(),
		defaultValue: [],
		loader: async () =>
			firstValueFrom(
				this._facade.getCorridors({
					rank: 'AVOIDANCE',
					limit: corridorLimit,
					minRideCount: corridorMinRideCount,
					...this.filters(),
				}),
			),
	});

	protected readonly topPreferredCorridors = resource<CorridorRanking[], string>({
		params: () => this.filtersKey(),
		defaultValue: [],
		loader: async () =>
			firstValueFrom(
				this._facade.getCorridors({
					rank: 'PREFERENCE',
					limit: corridorLimit,
					minRideCount: corridorMinRideCount,
					...this.filters(),
				}),
			),
	});

	protected readonly infrastructureSignals = resource<InfrastructureSignals | undefined, string>({
		params: () => `${this.filtersKey()}|${this.selectedInfrastructureDimension()}`,
		loader: async () =>
			firstValueFrom(
				this._facade.getInfrastructureSignals({
					dimension: this.selectedInfrastructureDimension(),
					limit: infrastructureLimit,
					minRideCount: infrastructureMinRideCount,
					...this.filters(),
				}),
			),
	});

	protected readonly infrastructureChartData = computed<ChartData<'bar'>>(() => {
		const buckets = this.infrastructureSignals.value()?.buckets ?? [];
		return {
			labels: buckets.map(
				(bucket) =>
					`${this.formatBucketValue(bucket.value)} (n=${bucket.totalRideSignals.toLocaleString('en')})`,
			),
			datasets: [
				{
					label: 'Difference from baseline',
					data: buckets.map(
						(bucket) => Math.round((bucket.percentagePointDifference ?? 0) * 10) / 10,
					),
					backgroundColor: buckets.map((bucket) =>
						(bucket.percentagePointDifference ?? 0) >= 0
							? avoidanceColor
							: preferenceColor,
					),
				},
			],
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
				grid: {
					color: (context) =>
						context.tick.value === 0 ? '#64748b' : 'rgba(148, 163, 184, 0.2)',
				},
			},
		},
	};

	protected readonly coverageNote = computed(() => {
		const result = this.infrastructureSignals.value();
		if (!result) {
			return undefined;
		}
		const coverage =
			result.coverageShare == null ? '0%' : `${(result.coverageShare * 100).toFixed(0)}%`;
		const baseline =
			result.baselineAvoidanceShare == null
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
		const count =
			type === 'AVOIDANCE' ? corridor.avoidanceRideCount : corridor.preferenceRideCount;
		return (count / total) * 100;
	}

	protected formatBucketValue(value: string): string {
		return value
			.toLowerCase()
			.split(/[_:]/)
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}

	protected formatSignedPercent(value: number): string {
		return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;
	}

	private detourImpactTooltip(context: TooltipItem<'boxplot'>): string[] {
		const item: RouteComparisonDetourImpact | undefined =
			this.eligibleDetourImpact()[context.dataIndex];
		if (!item) {
			return [];
		}
		return [
			`Median: ${this.formatSignedPercent(item.medianPercent)}`,
			`Middle 50%: ${this.formatSignedPercent(item.lowerQuartilePercent)} to ${this.formatSignedPercent(item.upperQuartilePercent)}`,
			`Eligible rides: ${item.eligibleRideCount.toLocaleString('en')}`,
		];
	}
}
