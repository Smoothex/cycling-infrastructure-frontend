import { Component, input, computed, signal, effect, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Card } from 'primeng/card';
import { Button } from 'primeng/button';
import { Select } from 'primeng/select';
import { InputNumber } from 'primeng/inputnumber';
import { ChartModule } from 'primeng/chart';
import { Skeleton } from 'primeng/skeleton';
import {
	TRAFFIC_TIMES_TO_TRANSLATION,
	WEEK_DAYS_TO_TRANSLATION, 
	YEAR_TO_TRANSLATION
} from '@simra/common-components';
import { TranslateService } from '@ngx-translate/core';
import {
	PagedProperties,
	PageableRequest,
	ChartConfig,
	createHistogram,
	createMovingMedianChart,
	createBoxPlot,
	createScatterPlot
} from '@simra/intersections-common';

const ChartCatergoryLabels = {
	trafficTime: "Traffic Time",
	weekDay: "Weeky Day",
	year: "Year",
}

const ChartCatergoryLabelTranslations = {
	trafficTime: TRAFFIC_TIMES_TO_TRANSLATION,
	weekDay: WEEK_DAYS_TO_TRANSLATION,
	year: YEAR_TO_TRANSLATION,
}

@Component({
	selector: 'intersection-chart',
	imports: [CommonModule, FormsModule, Card, Select, InputNumber, ChartModule, Skeleton, Button],
	templateUrl: './chart.html'
})
export class IntersectionChart<T, R extends PageableRequest> {
	public readonly header = input.required<string>();
    public readonly config = input.required<ChartConfig<T>>();
	public hasStartTime = input<boolean>(true);

	public readonly request = input.required<R | null>();
	public readonly fetchFn = input.required<(req: R, page: number, size: number) => Promise<PagedProperties<T>>>();

    private readonly pageSize = 500;
	protected readonly pagedProperties = signal<PagedProperties<T>| null>(null);
	protected readonly totalElements = computed(() => {
		const pagedProps = this.pagedProperties();
		if (!pagedProps) return 0;
		return pagedProps.metadata.totalElements;
	});
    protected readonly loading = signal(false);

	protected readonly accumulatedData = signal<T[]>([]);

	protected readonly propertyOptions = computed(() => 
        this.config().selectableProperties.map(key => ({
            label: this.config().labels[key],
            value: key
        }))
    );
	protected propertyChart = signal<keyof T>(null!);
	protected bucketSize = signal<number>(10.0);
	protected offset = signal<number>(5);
	protected readonly histogram = computed(() => {
		const props = this.accumulatedData();
		const selected = this.propertyChart(); 
    	const size = this.bucketSize();
		const offset = this.offset();
		return createHistogram(
			props.map(r => r[selected] as number), 
			size, 
			offset, 
			this.config().labels[selected], 
			'Number of Rides'
		);
	});

	protected readonly windowSize = signal(30);
	protected readonly scatterChart = computed(() => {
		const displayChart = this.hasStartTime();
		if (!displayChart) return;
		const data = this.accumulatedData();
		const selected = this.propertyChart();
		const window = this.windowSize();
		return createMovingMedianChart(
			data, 
			'startTime', 
			selected as string, 
			window, 
			this.config().labels[selected], 
		);
	});

	protected readonly groupByOptions = Object.entries(ChartCatergoryLabels).map(([value, label]) => ({
		label,
		value: value as keyof typeof ChartCatergoryLabels
	}));
	protected groupBy = signal<keyof typeof ChartCatergoryLabels>("trafficTime");
	protected readonly boxPlot = computed(() => {

		const data = this.accumulatedData();
		const groupKey = this.groupBy();
		const selected = this.propertyChart();

		const translation = ChartCatergoryLabelTranslations[groupKey] as any;
		const labelMap: Record<string, string> = {};
		for (const [key, value] of Object.entries(translation)) {
			labelMap[key] = this.translate.instant((value as any).label);
		}

		return createBoxPlot(
			data, 
			groupKey as keyof T, 
			selected, 
			ChartCatergoryLabels[groupKey], 
			labelMap,
			this.config().labels[selected], 
		);
	});

	protected propertyChart2 = signal<keyof T>(null!);
	protected readonly scatterChartProperties = computed(() => {
		const data = this.accumulatedData();
		const window = this.windowSize();
		const selected = this.propertyChart();
		const selected2 = this.propertyChart2();
		return createScatterPlot(
			data, 
			selected2 as string, 
			selected as string, 
			this.config().labels[selected2], 
			this.config().labels[selected], 
			window
		);
	});

	constructor(private translate: TranslateService) {
        effect(() => {
            this.propertyChart.set(this.config().defaultProperty);
        });

		effect(() => {
            this.propertyChart2.set(this.config().defaultProperty2);
        });

		effect(() => {
			const request = this.request();
			if (!request) return;
			untracked(() => {
				this.resetAndFetch();
			});
		})
	}

	private async resetAndFetch() {
        this.accumulatedData.set([]);
        this.pagedProperties.set(null);
        await this.loadMore();
    }

	protected async loadMore() {
		const request = this.request();
        if (this.loading() || !request) return;
        
		const pagedProps = this.pagedProperties();
        const page = pagedProps ? pagedProps.metadata.currentPage + 1 : 0;
		if (pagedProps && pagedProps.metadata.totalPages <= page) return;
		
		this.loading.set(true);
		const result = await this.fetchFn()(request, page, this.pageSize);
		this.accumulatedData.update(current => [...current, ...result.properties]);
		this.pagedProperties.set(result);
		this.loading.set(false);
    }
}
