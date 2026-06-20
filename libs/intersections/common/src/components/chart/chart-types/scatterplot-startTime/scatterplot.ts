import { Component, input, computed, signal, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { FormsModule } from '@angular/forms';
import {
    ChartConfig,
    SettingGroup,
    ChartFilter,
    ChartComplete,
} from '../../../../lib/common/interfaces';
import { createScatterPlotDate } from '../../../../lib/common/chart-helper';
import { ChartWrapperComponent } from '../../../chart-wrapper/chart-wrapper';

@Component({
    selector: 'intersection-scatter-plot-start-time',
    standalone: true,
    imports: [CommonModule, FormsModule, ChartModule, ChartWrapperComponent],
    templateUrl: './scatterplot.html',
})
export class ScatterPlotStartTimeComponent<T> {
    data = input.required<T[]>();
    selectedMetric = model.required<keyof T>();
    config = input.required<ChartConfig<T>>();
    label = input.required<string>();
    chartFilter = input.required<ChartFilter<T>>();

    protected readonly showAvgLine = signal<boolean>(true);
    protected readonly showMedianLine = signal<boolean>(false);
    protected readonly windowSize = signal(12);


    chartSettings = computed<SettingGroup[]>(() => [
        {
            group: 'Metric', items: [
                { label: 'Select Metric', props: { type: "select", value: this.selectedMetric, options: this.config().selectableProperties }}
            ]
        },
        {
            group: 'Lines', items: [
                { label: 'Display Average Line', props: { type: "boolean", value: this.showAvgLine}},
                { label: 'Display Median Line', props: { type: "boolean", value: this.showMedianLine}},
                { label: 'Half Window', props: { type: "number", value: this.windowSize, min: 0 }},
            ]
        }
    ]);

    protected chart = computed<ChartComplete>(() => {
        const d = this.chartData();
        return {
            chartType: "scatter",
            data: d.chart,
            options: d.options
        }
    });
    protected isExporting = signal<boolean>(false); 

    protected chartData = computed(() => {
        return createScatterPlotDate(
            this.data(), 
			'startTime',
			this.selectedMetric() as string,
            this.windowSize(),
            this.label(),
            this.showAvgLine(),
            this.showMedianLine()
        );
    });

    protected downloadFileName = computed<string>(() => 
        `scatterplot-${String(this.selectedMetric())}-time`);
}