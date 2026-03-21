import { Component, input, computed, signal, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { InputNumberModule } from 'primeng/inputnumber';
import { PopoverModule } from 'primeng/popover';
import { ButtonModule } from 'primeng/button';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';

import { createHistogram, ChartConfig, ChartWrapper } from '@simra/intersections-common';

@Component({
    selector: 'histogram-chart',
    standalone: true,
    imports: [CommonModule, ChartModule, InputNumberModule, PopoverModule, ButtonModule, Select, FormsModule, ChartWrapper],
    templateUrl: './histogram.html',
})
export class HistogramChart<T> {
    // Inputs
    data = input.required<T[]>();
    selectedMetric = model.required<keyof T>();
    config = input.required<ChartConfig<T>>();
    label = input.required<string>();

    // Internal State (Settings)
    protected bucketSize = signal<number>(10);
    protected offset = signal<number>(5);

    // Computed Chart Data
    protected chartData = computed(() => {
        const rawValues = this.data().map(r => r[this.selectedMetric()] as number);
        
        // Assuming your createHistogram helper is imported/available
        return createHistogram(
            rawValues,
            this.bucketSize(),
            this.offset(),
            this.label(),
            'Number of Rides'
        );
    });
}