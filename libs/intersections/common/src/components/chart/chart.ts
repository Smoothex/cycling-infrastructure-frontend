import { Component, input, computed, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Card } from 'primeng/card';
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
	imports: [CommonModule, FormsModule, Card, Select, InputNumber, ChartModule, Skeleton],
	templateUrl: './chart.html'
})
export class IntersectionChart<T> {
	public readonly header = input.required<string>();
	public readonly data = input.required<T[]>();
    public readonly config = input.required<ChartConfig<T>>();
	public loading = input.required<boolean>();
	public hasStartTime = input<boolean>(true);

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
		const props = this.data();
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
		const data = this.data();
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

		const data = this.data();
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
		const data = this.data();
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
	}
}
