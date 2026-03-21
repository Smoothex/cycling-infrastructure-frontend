import { Component, input, computed, signal, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { InputNumberModule } from 'primeng/inputnumber';
import { PopoverModule } from 'primeng/popover';
import { ButtonModule } from 'primeng/button';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';

import { createHeatmapBinning, ChartConfig, ChartWrapper } from '@simra/intersections-common';

@Component({
    selector: 'heatmap-start-time-chart',
    standalone: true,
    imports: [CommonModule, ChartModule, InputNumberModule, PopoverModule, ButtonModule, Select, FormsModule, ChartWrapper],
    templateUrl: './heatmap.html',
    styleUrl: './heatmap.scss'
})
export class HeatmapStartTimeChart<T> {
    // Inputs
    data = input.required<T[]>();
    selectedMetric = model.required<keyof T>();
    config = input.required<ChartConfig<T>>();
    label = input.required<string>();

    // Internal State (Settings)
    protected yBucketSize = signal<number>(10);
    protected yOffset = signal<number>(5);

    protected weeks = signal<number>(5);

    // Computed Chart Data
    protected chartData = computed(() => {
        return createHeatmapBinning(
			this.data(), 
			'startTime',
			this.selectedMetric() as string,
			'Date',
			this.label(),
			1000 * 60 * 60 * 24 * 7 * this.weeks(),
			this.yBucketSize(),
			0,
			this.yOffset()
		)
    });
}