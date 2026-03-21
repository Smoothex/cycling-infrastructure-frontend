import { Component, input, computed, signal, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { InputNumberModule } from 'primeng/inputnumber';
import { PopoverModule } from 'primeng/popover';
import { ButtonModule } from 'primeng/button';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';

import { createScatterPlotDate, ChartConfig, ChartWrapper } from '@simra/intersections-common';

@Component({
    selector: 'scatter-plot-start-time',
    standalone: true,
    imports: [CommonModule, ChartModule, InputNumberModule, PopoverModule, ButtonModule, Select, FormsModule, ChartWrapper],
    templateUrl: './scatterplot.html',
})
export class ScatterPlotStartTime<T> {
    // Inputs
    data = input.required<T[]>();
    selectedMetric = model.required<keyof T>();
    config = input.required<ChartConfig<T>>();
    label = input.required<string>();

    // Internal State (Settings)
    protected readonly windowSize = signal(12);

    // Computed Chart Data
    protected chartData = computed(() => {
        return createScatterPlotDate(
            this.data(), 
			'startTime',
			this.selectedMetric() as string,
            this.windowSize(),
            this.label()
        );
    });
}