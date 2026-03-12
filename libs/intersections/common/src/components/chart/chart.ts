import { Component, effect, input, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Card } from 'primeng/card';
import { Select } from 'primeng/select';
import { InputNumber } from 'primeng/inputnumber';
import { ChartModule } from 'primeng/chart';
import { EYear, ETrafficTimes, EWeekDays } from '@simra/common-models';
import {
	TRAFFIC_TIMES_TO_TRANSLATION,
	WEEK_DAYS_TO_TRANSLATION, 
	YEAR_TO_TRANSLATION
} from '@simra/common-components';
import { TranslateService } from '@ngx-translate/core';
import {
	Base,
	createHistogram,
	createMovingMedianChart,
	createBoxPlot
} from '@simra/intersections-common';

const ChartPropertyLabels = {
	waitingTime: "WaitingTime (s)",
	duration: "Duration (s)",
	speed: "Speed (km/h)",
	medianRideSpeed: "Median Ride Speed (km/h)"
}

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
	imports: [CommonModule, FormsModule, Card, Select, InputNumber, ChartModule],
	templateUrl: './chart.html'
})
export class IntersectionChart {
	public readonly data = input.required<Base[]>();

	protected readonly propertyOptions = Object.entries(ChartPropertyLabels).map(([value, label]) => ({
		label,
		value: value as keyof typeof ChartPropertyLabels
	}));
	protected propertyChart = signal<keyof typeof ChartPropertyLabels>("waitingTime");
	protected bucketSize = signal<number>(10);
	protected offset = signal<number>(5);
	protected readonly histogram = computed(() => {
		const props = this.data();
		const selected = this.propertyChart(); 
    	const size = this.bucketSize();
		const offset = this.offset();
		return createHistogram(props.map(r => r[selected]), size, offset, ChartPropertyLabels[selected], 'Number of Rides');
	});

	protected readonly windowSize = signal(30);
	protected readonly scatterChart = computed(() => {
		const data = this.data();
		const selected = this.propertyChart();
		const window = this.windowSize();
		return createMovingMedianChart(
			data, 
			'startTime', 
			selected, 
			window, 
			ChartPropertyLabels[selected]
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
			groupKey, 
			selected, 
			ChartCatergoryLabels[groupKey], 
			labelMap,
			ChartPropertyLabels[selected]
		);
	});

	constructor(private translate: TranslateService) {}
}
