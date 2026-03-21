import { Component, input, computed, signal, effect, untracked } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Card } from 'primeng/card';
import { Button } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { Skeleton } from 'primeng/skeleton';
import {
	PagedProperties,
	PageableRequest,
	ChartConfig,
	AggregatedResult
} from '@simra/intersections-common';
import { HeatmapChart } from '../chart/chart-types/heatmap/heatmap';
import { ScatterPlot } from '../chart/chart-types/scatterplot/scatterplot';

@Component({
	selector: 'intersection-chart-metric-array',
	imports: [CommonModule, FormsModule, Card, ChartModule, Button, Skeleton, HeatmapChart, ScatterPlot
    	],
	templateUrl: './chart.html',
	styleUrl: './heatmap.scss'
})
export class IntersectionChartMatricArray<T extends AggregatedResult, R extends PageableRequest> {
	public readonly header = input.required<string>();
    public readonly config = input.required<ChartConfig<T>>();

	public readonly request = input.required<R | null>();
	public readonly fetchFn = input.required<(req: R, page: number, size: number) => Promise<PagedProperties<T>>>();

    private readonly pageSize = 500;
	protected readonly pagedProperties = signal<PagedProperties<T>| null>(null);
	protected readonly totalElements = computed(() => {
		const pagedProps = this.pagedProperties();
		if (!pagedProps) return 0;
		return pagedProps.metadata.totalElements;
	});
    protected readonly loading = signal(false);
	protected readonly accumulatedData = signal<T[]>([]);
	
	protected readonly label = computed(() => {
		for (const el of this.config().selectableProperties) {
			if (el.value === this.propertyChart()) return el.label;
		}
		return "";
	});
	protected propertyChart = signal<keyof T>(null!);


	constructor() {
        effect(() => {
            this.propertyChart.set(this.config().defaultProperty);
        });

		effect(() => {
			const request = this.request();
			if (!request) return;
			untracked(() => {
				this.resetAndFetch();
			});
		})
	}

	private async resetAndFetch() {
        this.accumulatedData.set([]);
        this.pagedProperties.set(null);
        await this.loadMore();
    }

	protected async loadMore() {
		const request = this.request();
        if (this.loading() || !request) return;
        
		const pagedProps = this.pagedProperties();
        const page = pagedProps ? pagedProps.metadata.currentPage + 1 : 0;
		if (pagedProps && pagedProps.metadata.totalPages <= page) return;
		
		this.loading.set(true);
		const result = await this.fetchFn()(request, page, this.pageSize);
		this.accumulatedData.update(current => [...current, ...result.properties]);
		this.pagedProperties.set(result);
		this.loading.set(false);
    }

	protected async loadAll() {
		const request = this.request();
		const pagedProps = this.pagedProperties();
        if (this.loading() || !request || !pagedProps) return;
		
		this.loading.set(true);

		for (let page = pagedProps.metadata.currentPage + 1; page <= pagedProps.metadata.totalPages; page++) {
			const result = await this.fetchFn()(request, page, this.pageSize);
			this.accumulatedData.update(current => [...current, ...result.properties]);
			this.pagedProperties.set(result);
		}
		
		this.loading.set(false);
    }
}
