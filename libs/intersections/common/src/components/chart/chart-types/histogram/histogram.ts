import { Component, input, computed, signal, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { FormsModule } from '@angular/forms';

import { createHistogram, ChartConfig, ChartWrapper, SettingGroup, ChartFilter, ChartComplete } from '@simra/intersections-common';

@Component({
    selector: 'histogram-chart',
    standalone: true,
    imports: [CommonModule, FormsModule, ChartModule, ChartWrapper],
    templateUrl: './histogram.html',
})
export class HistogramChart<T> {
    data = input.required<T[]>();
    selectedMetric = model.required<keyof T>();
    config = input.required<ChartConfig<T>>();
    label = input.required<string>();
    chartFilter = input.required<ChartFilter<T>>();

    
    protected bucketSize = signal<number>(10);
    protected offset = signal<number>(5);
    protected minView = signal<number | null>(null);
    protected maxView = signal<number | null>(null);

    chartSettings = computed<SettingGroup[]>(() => [
        {
            group: 'Metric', items: [
                { label: 'Select Metric', props: { type: "select", value: this.selectedMetric, options: this.config().selectableProperties }}
            ]
        },
        {
            group: 'Buckets', items: [
                { label: 'Bucket Size', props: { type: "number", value: this.bucketSize, min: 0.01, max: 100 }},
                { label: 'Offset', props: { type: "number", value: this.offset, min: 0, max: 100 }},
            ]
        },
        {
            group: 'View', items: [
                { label: 'Minimum Value', props: { type: "number", value: this.minView }},
                { label: 'Maximum Value', props: { type: "number", value: this.maxView }},
            ]
        }
    ]);

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
        return createHistogram(
            this.data(),
            this.selectedMetric(),
            this.bucketSize(),
            this.offset(),
            this.label(),
            this.config().aggregationLabel,
            this.minView() ?? undefined,
            this.maxView() ?? undefined
        );
    });

    protected downloadFileName = computed<string>(() => {
        const baseName = `bar-${String(this.selectedMetric())}-numberOfRides`;

        const viewMin = this.minView() ? `-min-${this.minView()}` : "";
        const viewMax = this.maxView() ? `-max-${this.maxView()}` : "";
        const viewName = (viewMin || viewMax) ? `-view${viewMin}${viewMax}` : "";

        return `${baseName}${viewName}`;
    });
}