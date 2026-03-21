import { Component, input, computed, signal, effect, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ChartModule } from 'primeng/chart';
import { InputNumberModule } from 'primeng/inputnumber';
import { PopoverModule } from 'primeng/popover';
import { ButtonModule } from 'primeng/button';
import { Select } from 'primeng/select';
import { FormsModule } from '@angular/forms';

import { ChartConfig, createScatterPlot, ChartWrapper } from '@simra/intersections-common';

@Component({
    selector: 'scatter-plot',
    standalone: true,
    imports: [CommonModule, ChartModule, InputNumberModule, PopoverModule, ButtonModule, Select, FormsModule, ChartWrapper],
    templateUrl: './scatterplot.html',
})
export class ScatterPlot<T> {
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
    protected readonly windowSize = signal(12);

    // Computed Chart Data
    protected chartData = computed(() => {
        return createScatterPlot(
            this.data(), 
			this.propertyChart() as string,
			this.selectedMetric() as string,
            this.labelPropertyChart(),
            this.label(),
            this.windowSize()
        );
    });

    constructor() {
        effect(() => {
            this.propertyChart.set(this.config().defaultProperty2);
        });
    }
}