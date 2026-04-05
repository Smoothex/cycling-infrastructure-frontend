import { Component, input, computed, signal, effect, model, linkedSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { FormsModule } from '@angular/forms';

import { ChartConfig, createScatterPlot, ChartWrapper, SettingGroup, ChartFilter, ChartComplete } from '@simra/intersections-common';

@Component({
    selector: 'scatter-plot',
    standalone: true,
    imports: [CommonModule, FormsModule, ChartModule, ChartWrapper],
    templateUrl: './scatterplot.html',
})
export class ScatterPlot<T> {
    data = input.required<T[]>();
    selectedMetric = model.required<keyof T>();
    config = input.required<ChartConfig<T>>();
    label = input.required<string>();
    chartFilter = input.required<ChartFilter<T>>();

	protected propertyChart = linkedSignal(() => this.config().defaultProperty2);
    protected readonly labelPropertyChart = computed(() => {
		for (const el of this.config().selectableProperties) {
			if (el.value === this.propertyChart()) return el.label;
		}
		return "";
	});

    protected readonly showAvgLine = signal<boolean>(true);
    protected readonly showMedianLine = signal<boolean>(false);
    protected readonly windowSize = signal(12);


    chartSettings = computed<SettingGroup[]>(() => [
        {
            group: 'Metric', items: [
                { label: 'Select Metric', props: { type: "select", value: this.selectedMetric, options: this.config().selectableProperties }},
                { label: 'Select Compare Metric', props: { type: "select", value: this.propertyChart, options: this.config().selectableProperties }},
            ]
        },
        {
            group: 'Lines', items: [
                { label: 'Display Average Line', props: { type: "boolean", value: this.showAvgLine}},
                { label: 'Display Median Line', props: { type: "boolean", value: this.showMedianLine}},
                { label: 'Half Window', props: { type: "number", value: this.windowSize, min: 0, max: 100 }},
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
        return createScatterPlot(
            this.data(), 
			this.propertyChart() as string,
			this.selectedMetric() as string,
            this.labelPropertyChart(),
            this.label(),
            this.windowSize(),
            this.showAvgLine(),
            this.showMedianLine()
        );
    });

    protected downloadFileName = computed<string>(() => 
        `scatterplot-${String(this.selectedMetric())}-${String(this.propertyChart())}`);
}