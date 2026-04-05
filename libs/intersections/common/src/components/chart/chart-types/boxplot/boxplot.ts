import { Component, input, computed, signal, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { FormsModule } from '@angular/forms';
import { TranslateService } from '@ngx-translate/core';
import { createBoxPlot, ChartConfig, ChartWrapper, SettingGroup, ChartFilter, TimeCategory, recordToOptions, TimeCategoryLabels, ChartComplete } from '@simra/intersections-common';
import {
	TRAFFIC_TIMES_TO_TRANSLATION,
	WEEK_DAYS_TO_TRANSLATION, 
	YEAR_TO_TRANSLATION
} from '@simra/common-components';

const ChartCatergoryLabelTranslations = {
    trafficTime: TRAFFIC_TIMES_TO_TRANSLATION,
    weekDay: WEEK_DAYS_TO_TRANSLATION,
    year: YEAR_TO_TRANSLATION,
}


@Component({
    selector: 'boxplot-chart',
    standalone: true,
    imports: [CommonModule, FormsModule, ChartModule, ChartWrapper],
    templateUrl: './boxplot.html',
})
export class BoxplotChart<T> {
    data = input.required<T[]>();
    selectedMetric = model.required<keyof T>();
    config = input.required<ChartConfig<T>>();
    label = input.required<string>();
    chartFilter = input.required<ChartFilter<T>>();

    protected minView = signal<number | null>(null);
    protected maxView = signal<number | null>(null);
    protected groupBy = signal<TimeCategory>("trafficTime");

    chartSettings = computed<SettingGroup[]>(() => [
        {
            group: 'Metric', items: [
                { label: 'Select Metric', props: { type: "select", value: this.selectedMetric, options: this.config().selectableProperties }},
                { label: 'Select Category', props: { type: "select", value: this.groupBy, options: recordToOptions(TimeCategoryLabels) }},
            ]
        },
        {
            group: 'View', items: [
                { label: 'Minimum Value', props: { type: "number", value: this.minView }},
                { label: 'Maximum Value', props: { type: "number", value: this.maxView }}
            ]
        }
    ]);

    protected chart = computed<ChartComplete>(() => {
        const d = this.chartData();
        return {
            chartType: "boxplot",
            data: d.chart,
            options: d.options
        }
    })
    protected isExporting = signal<boolean>(false); 

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
            TimeCategoryLabels[groupKey], 
            labelMap,
            this.label(),
            this.minView() ?? undefined,
            this.maxView() ?? undefined
        );
    });

    protected downloadFileName = computed<string>(() => {
        const baseName = `boxplot-${String(this.selectedMetric())}-${String(this.groupBy())}`;

        const viewMin = this.minView() ? `-min-${this.minView()}` : "";
        const viewMax = this.maxView() ? `-max-${this.maxView()}` : "";
        const viewName = (viewMin || viewMax) ? `-view${viewMin}${viewMax}` : "";

        return `${baseName}${viewName}`;
    });

    constructor(private translate: TranslateService) {}
}