import { Component, input, computed, signal, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { FormsModule } from '@angular/forms';

import { createHeatmapBinning, ChartConfig, ChartWrapper, SettingGroup, ChartFilter, ChartComplete } from '@simra/intersections-common';

@Component({
    selector: 'heatmap-start-time-chart',
    standalone: true,
    imports: [CommonModule, FormsModule, ChartModule, ChartWrapper],
    templateUrl: './heatmap.html',
    styleUrl: './heatmap.scss'
})
export class HeatmapStartTimeChart<T> {
    data = input.required<T[]>();
    selectedMetric = model.required<keyof T>();
    config = input.required<ChartConfig<T>>();
    label = input.required<string>();
    chartFilter = input.required<ChartFilter<T>>();

    
    protected yBucketSize = signal<number>(10);
    protected yOffset = signal<number>(5);
    protected minViewY = signal<number | null>(null);
    protected maxViewY = signal<number | null>(null);
    protected maxViewCount = signal<number | null>(null);

    protected weeks = signal<number>(6);


    chartSettings = computed<SettingGroup[]>(() => [
        {
            group: 'Metric', items: [
                { label: 'Select Metric', props: { type: "select", value: this.selectedMetric, options: this.config().selectableProperties }},
            ]
        },
        {
            group: 'Buckets', items: [
                { label: 'Y Bucket Size', props: { type: "number", value: this.yBucketSize, min: 0.01 }},
                { label: 'Y Offset', props: { type: "number", value: this.yOffset, min: 0 }},
                { label: 'Weeks', props: { type: "number", value: this.weeks, min: 0.01 }},
            ]
        },
        {
            group: 'View', items: [
                { label: 'Minimum Value Y', props: { type: "number", value: this.minViewY }},
                { label: 'Maximum Value Y', props: { type: "number", value: this.maxViewY }},
                { label: 'Maximum Count', props: { type: "number", value: this.maxViewCount, min:2 }},
            ]
        }
    ]);

    protected chart = computed<ChartComplete>(() => {
        const d = this.chartData();
        return {
            chartType: "matrix",
            data: d.chart,
            options: d.options
        }
    });
    protected isExporting = signal<boolean>(false); 

    protected chartData = computed(() => {
        return createHeatmapBinning(
			this.data(), 
			'startTime',
			this.selectedMetric() as string,
            this.config().idKey,
			'Date',
			this.label(),
			1000 * 60 * 60 * 24 * 7 * this.weeks(),
			this.yBucketSize(),
			0,
			this.yOffset(),
            undefined,
            undefined,
            this.minViewY() ?? undefined,
            this.maxViewY() ?? undefined,
            this.maxViewCount() ?? undefined
		)
    });

    protected downloadFileName = computed<string>(() => {
        const baseName = `heatmap-${String(this.selectedMetric())}-time`;

        const viewMinY = this.minViewY() ? `-min-${this.minViewY()}` : "";
        const viewMaxY = this.maxViewY() ? `-max-${this.maxViewY()}` : "";
        const viewNameY = (viewMinY || viewMaxY) ? `-Y-${viewMinY}${viewMaxY}` : "";

        const viewName = (viewNameY) ? `-view${viewNameY}` : "";

        return `${baseName}${viewName}`;
    });
}