import { Component, input, computed, signal, effect, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { InputNumberModule } from 'primeng/inputnumber';
import { PopoverModule } from 'primeng/popover';
import { ButtonModule } from 'primeng/button';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';

import { ChartConfig, createHeatmapBinning, ChartWrapper } from '@simra/intersections-common';

@Component({
    selector: 'heatmap-chart',
    standalone: true,
    imports: [CommonModule, ChartModule, InputNumberModule, PopoverModule, ButtonModule, Select, FormsModule, ChartWrapper],
    templateUrl: './heatmap.html',
    styleUrl: './heatmap.scss'
})
export class HeatmapChart<T> {
    // Inputs
    data = input.required<T[]>();
    selectedMetric = model.required<keyof T>();
    config = input.required<ChartConfig<T>>();
    label = input.required<string>();

	protected propertyChart = signal<keyof T>(null!);
    protected readonly labelPropertyChart = computed(() => {
		for (const el of this.config().selectableProperties) {
			if (el.value === this.propertyChart()) return el.label;
		}
		return "";
	});

    // Internal State (Settings)
    protected yBucketSize = signal<number>(10);
    protected yOffset = signal<number>(5);

    protected xBucketSize = signal<number>(1);
    protected xOffset = signal<number>(0);

    // Computed Chart Data
    protected chartData = computed(() => {
        return createHeatmapBinning(
			this.data(), 
			this.propertyChart() as string,
			this.selectedMetric() as string,
			this.labelPropertyChart(),
			this.label(),
			this.xBucketSize(),
			this.yBucketSize(),
			this.xOffset(),
			this.yOffset()
		)
    });

    constructor() {
        effect(() => {
            this.propertyChart.set(this.config().defaultProperty2);
        });
    }
}