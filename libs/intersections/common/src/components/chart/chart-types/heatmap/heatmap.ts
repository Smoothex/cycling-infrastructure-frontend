import { Component, input, computed, signal, effect, model, linkedSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { FormsModule } from '@angular/forms';

import { ChartConfig, createHeatmapBinning, ChartWrapper, SettingGroup, ChartFilter, ChartComplete } from '@simra/intersections-common';

@Component({
    selector: 'heatmap-chart',
    standalone: true,
    imports: [CommonModule, FormsModule, ChartModule, ChartWrapper],
    templateUrl: './heatmap.html',
    styleUrl: './heatmap.scss'
})
export class HeatmapChart<T> {
    // Inputs
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


    // Internal State (Settings)
    protected yBucketSize = signal<number>(10);
    protected yOffset = signal<number>(5);

    protected xBucketSize = signal<number>(2);
    protected xOffset = signal<number>(0);

    protected minViewX = signal<number | null>(null);
    protected maxViewX = signal<number | null>(null);
    protected minViewY = signal<number | null>(null);
    protected maxViewY = signal<number | null>(null);
    protected maxViewCount = signal<number | null>(null);

    chartSettings = computed<SettingGroup[]>(() => [
        {
            group: 'Metric', items: [
                { label: 'Select Metric', props: { type: "select", value: this.selectedMetric, options: this.config().selectableProperties }},
                { label: 'Select Compare Metric', props: { type: "select", value: this.propertyChart, options: this.config().selectableProperties }},
            ]
        },
        {
            group: 'Buckets', items: [
                { label: 'Y Bucket Size', props: { type: "number", value: this.yBucketSize, min: 0.01, max: 100 }},
                { label: 'Y Offset', props: { type: "number", value: this.yOffset, min: 0, max: 100 }},
                { label: 'X Bucket Size', props: { type: "number", value: this.xBucketSize, min: 0.01, max: 100 }},
                { label: 'X Offset', props: { type: "number", value: this.xOffset, min: 0, max: 100 }},
            ]
        },
        {
            group: 'View', items: [
                { label: 'Minimum Value X', props: { type: "number", value: this.minViewX }},
                { label: 'Maximum Value X', props: { type: "number", value: this.maxViewX }},
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
			this.propertyChart() as string,
			this.selectedMetric() as string,
            this.config().idKey,
			this.labelPropertyChart(),
			this.label(),
			this.xBucketSize(),
			this.yBucketSize(),
			this.xOffset(),
			this.yOffset(),
            this.minViewX() ?? undefined,
            this.maxViewX() ?? undefined,
            this.minViewY() ?? undefined,
            this.maxViewY() ?? undefined,
            this.maxViewCount() ?? undefined
		)
    });

    protected downloadFileName = computed<string>(() => {
        const baseName = `heatmap-${String(this.selectedMetric())}-${String(this.propertyChart())}`;

        const viewMinX = this.minViewX() ? `-min-${this.minViewX()}` : "";
        const viewMaxX = this.maxViewX() ? `-max-${this.maxViewX()}` : "";
        const viewNameX = (viewMinX || viewMaxX) ? `-X-${viewMinX}${viewMaxX}` : "";

        const viewMinY = this.minViewY() ? `-min-${this.minViewY()}` : "";
        const viewMaxY = this.maxViewY() ? `-max-${this.maxViewY()}` : "";
        const viewNameY = (viewMinY || viewMaxY) ? `-Y-${viewMinY}${viewMaxY}` : "";

        const viewName = (viewNameX || viewNameY) ? `-view${viewNameX}${viewNameY}` : "";

        return `${baseName}${viewName}`;
    });
}