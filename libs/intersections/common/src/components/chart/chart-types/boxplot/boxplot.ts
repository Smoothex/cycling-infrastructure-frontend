import { Component, input, computed, signal, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { PopoverModule } from 'primeng/popover';
import { ButtonModule } from 'primeng/button';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { createBoxPlot, ChartConfig, ChartWrapper } from '@simra/intersections-common';
import {
	TRAFFIC_TIMES_TO_TRANSLATION,
	WEEK_DAYS_TO_TRANSLATION, 
	YEAR_TO_TRANSLATION
} from '@simra/common-components';

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
    selector: 'boxplot-chart',
    standalone: true,
    imports: [CommonModule, ChartModule, ButtonModule, Select, PopoverModule, FormsModule, ChartWrapper],
    templateUrl: './boxplot.html',
})
export class BoxplotChart<T> {
    // Inputs
    data = input.required<T[]>();
    selectedMetric = model.required<keyof T>();
    config = input.required<ChartConfig<T>>();
    label = input.required<string>();

    // Internal State (Settings)
    protected readonly groupByOptions = Object.entries(ChartCatergoryLabels).map(([value, label]) => ({
		label,
		value: value as keyof typeof ChartCatergoryLabels
	}));
    protected groupBy = signal<keyof typeof ChartCatergoryLabels>("trafficTime");

    // Computed Chart Data
    protected chartData = computed(() => {
        const data = this.data();
        const groupKey = this.groupBy();
        const selected = this.selectedMetric();
        
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
            this.label(), 
        );
    });

    constructor(private translate: TranslateService) {}
}