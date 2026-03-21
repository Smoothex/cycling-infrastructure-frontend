import { Component, input, computed, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Card } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { PopoverModule } from 'primeng/popover';
import { Select } from 'primeng/select';
import { ChartModule } from 'primeng/chart';
import { Skeleton } from 'primeng/skeleton';
import {
	AggregatedResult,
	PrecomputedRequest,
	ChartConfig,
	createBarChartForMetric,
	ChartWrapper
} from '@simra/intersections-common';
import { EYear, ETrafficTimes, EWeekDays } from '@simra/common-models';
import {
	TRAFFIC_TIMES_TO_TRANSLATION,
	WEEK_DAYS_TO_TRANSLATION, 
	YEAR_TO_TRANSLATION
} from '@simra/common-components';
import { TranslateService } from '@ngx-translate/core';

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
	selector: 'intersection-chart-metric',
	imports: [CommonModule, FormsModule, Card, ChartModule, Skeleton, ButtonModule, PopoverModule, Select, ChartWrapper],
	templateUrl: './chart.html'
})
export class IntersectionChartMetric<T extends AggregatedResult, R extends PrecomputedRequest> {
	public readonly header = input.required<string>();
    public readonly config = input.required<ChartConfig<T>>();

	public readonly request = input.required<R | null>();
	public readonly fetchFn = input.required<(req: R) => Promise<T | null>>();
    protected readonly loading = signal(true);

	protected readonly label = computed(() => {
		for (const el of this.config().selectableProperties) {
			if (el.value === this.propertyChart()) return el.label;
		}
		return "";
	});

	
	protected propertyChart = signal<keyof T>(null!);
	protected readonly groupByOptions = Object.entries(ChartCatergoryLabels).map(([value, label]) => ({
		label,
		value: value as keyof typeof ChartCatergoryLabels
	}));
	protected groupBy = signal<keyof typeof ChartCatergoryLabels>("trafficTime");

	protected readonly trafficTimeData = signal<T[]>([]);
	protected readonly weekDayData = signal<T[]>([]);
	protected readonly yearData = signal<T[]>([]);

	protected chartData = computed(() => {
		const groupKey = this.groupBy();
        const selected = this.propertyChart();
		let data: T[] = [];
		if (groupKey === "trafficTime") data = this.trafficTimeData();
		if (groupKey === "weekDay") data = this.weekDayData();
		if (groupKey === "year") data = this.yearData();
        
        const translation = ChartCatergoryLabelTranslations[groupKey] as any;
        const labelMap: Record<string, string> = {};
        for (const [key, value] of Object.entries(translation)) {
            labelMap[key] = this.translate.instant((value as any).label);
        }
		
		return createBarChartForMetric(data, groupKey, selected, ChartCatergoryLabels[groupKey], labelMap, this.label());
	});

	constructor(private translate: TranslateService) {
        effect(() => {
            this.propertyChart.set(this.config().defaultProperty);
        });

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
