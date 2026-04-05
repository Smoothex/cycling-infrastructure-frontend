import { Component, input, computed, signal, effect, linkedSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Card } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { Skeleton } from 'primeng/skeleton';
import {
	AggregatedResult,
	PrecomputedRequest,
	ChartConfig,
	createBarChartForMetric,
	ChartWrapper,
	SettingGroup,
	ChartFilter,
	TimeCategory,
	recordToOptions,
	TimeCategoryLabels,
	ChartComplete
} from '@simra/intersections-common';
import { EYear, ETrafficTimes, EWeekDays } from '@simra/common-models';
import {
	TRAFFIC_TIMES_TO_TRANSLATION,
	WEEK_DAYS_TO_TRANSLATION, 
	YEAR_TO_TRANSLATION
} from '@simra/common-components';
import { TranslateService } from '@ngx-translate/core';

const ChartCatergoryLabelTranslations = {
    trafficTime: TRAFFIC_TIMES_TO_TRANSLATION,
    weekDay: WEEK_DAYS_TO_TRANSLATION,
    year: YEAR_TO_TRANSLATION,
}


@Component({
	selector: 'intersection-chart-metric',
	imports: [CommonModule, FormsModule, ChartModule, ChartWrapper, Skeleton, Card],
	templateUrl: './chart.html'
})
export class IntersectionChartMetric<T extends AggregatedResult, R extends PrecomputedRequest> {
	public readonly header = input.required<string>();
    public readonly config = input.required<ChartConfig<T>>();

	public readonly request = input.required<R | null>();
	public readonly fetchFn = input.required<(req: R) => Promise<T | null>>();
    protected readonly loading = signal(true);


	protected propertyChart = linkedSignal(() => this.config().defaultProperty);
	protected readonly label = computed(() => {
		for (const el of this.config().selectableProperties) if (el.value === this.propertyChart()) return el.label;
		return "";
	});
	protected groupBy = signal<TimeCategory>("year");

	chartSettings = computed<SettingGroup[]>(() => [
		{
			group: 'Metric', items: [
				{ label: 'Select Metric', props: { type: "select", value: this.propertyChart, options: this.config().selectableProperties }},
				{ label: 'Select Category', props: { type: "select", value: this.groupBy, options: recordToOptions(TimeCategoryLabels) }},
			]
		}
	]);
	protected downloadFileName = computed<string>(() => 
        `bar-${String(this.propertyChart())}-${String(this.groupBy())}`);

	protected data = computed<T[]>(() => {
		const groupKey = this.groupBy();
		if (groupKey === "trafficTime") return this.trafficTimeData();
		if (groupKey === "weekDay") return this.weekDayData();
		if (groupKey === "year") return this.yearData();
		return [];
	});

	protected filterMin = signal<number | null>(null);
	protected filterMax = signal<number | null>(null);
	protected filterProperty = linkedSignal(() => this.config().defaultProperty2);
	protected filterPropertyLabel = computed(() => {
		for (const el of this.config().selectableProperties) if (el.value === this.filterProperty()) return el.label;
		return "";
	});
	protected readonly filteredData = computed<T[]>(() => {
		let filteredData = this.data();
		const filterCategory = this.filterProperty();
		if (!filterCategory) return filteredData;

		const minFilter = this.filterMin();
		if (minFilter) filteredData = filteredData.filter(d => d[filterCategory] as number >= minFilter);

		const maxFilter = this.filterMax();
		if (maxFilter) filteredData = filteredData.filter(d => d[filterCategory] as number <= maxFilter);
		return filteredData;
	});
	protected total = computed<number>(() => this.data().length);
	protected excluded = computed<number>(() => this.data().length - this.filteredData().length);
	protected chartFilter = computed<ChartFilter<T>>(() => {
		return {
			min: this.filterMin,
			max: this.filterMax,
			onProperty: this.filterProperty,
			onPropertyLabel: this.filterPropertyLabel,
			selectableProperties: this.config().selectableProperties,
			totalElements: this.total,
			excludedElements: this.excluded
	}});


	protected readonly trafficTimeData = signal<T[]>([]);
	protected readonly weekDayData = signal<T[]>([]);
	protected readonly yearData = signal<T[]>([]);

	protected chart = computed<ChartComplete>(() => {
		const d = this.chartData();
		return {
			chartType: "bar",
			data: d.chart,
			options: d.options
		}
	});
	protected isExporting = signal<boolean>(false);

	protected chartData = computed(() => {
		const groupKey = this.groupBy();
        const selected = this.propertyChart();
        
        const translation = ChartCatergoryLabelTranslations[groupKey] as any;
        const labelMap: Record<string, string> = {};
        for (const [key, value] of Object.entries(translation)) {
            labelMap[key] = this.translate.instant((value as any).label);
        }
		
		return createBarChartForMetric(this.filteredData(), groupKey, selected, TimeCategoryLabels[groupKey], labelMap, this.label());
	});

	constructor(private translate: TranslateService) {
		effect(async () => {
			const defaultRequest = this.request();
			if (!defaultRequest) return;
			
			this.loading.set(true);
			
			const trafficTimesResults: T[] = [];
			for (const value of Object.values(ETrafficTimes)) {
				const trafficTimeRequest = { ...defaultRequest };
				if (value === 'ALL_DAY') continue;
				trafficTimeRequest.trafficTime = value;
				const data = await this.fetchFn()(trafficTimeRequest);
				if (data) trafficTimesResults.push(data);
			}
			this.trafficTimeData.set(trafficTimesResults);

			
			const weekDayResults: T[] = [];
			for (const value of Object.values(EWeekDays)) {
				const weekDayRequest = { ...defaultRequest };
				if (value === 'ALL_WEEK') continue;
				weekDayRequest.weekDay = value;
				const data = await this.fetchFn()(weekDayRequest);
				if (data) weekDayResults.push(data);
			}
			this.weekDayData.set(weekDayResults);

			
			const yearResults: T[] = [];
			for (const value of Object.values(EYear)) {
				const yearRequest = { ...defaultRequest };
				if (value === '2000') continue;
				yearRequest.year = value;
				const data = await this.fetchFn()(yearRequest);
				if (data) yearResults.push(data);
			}
			this.yearData.set(yearResults);

			this.loading.set(false);
		})
	}
}
