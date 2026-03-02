import { Component, effect, input, Input, Signal, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ChartModule } from 'primeng/chart';
import { Feature, FeatureCollection, GeoJsonProperties, LineString, Point, Polygon } from 'geojson';
import { 
	NodeRow,
	EdgeRow,
	ListColumn,
	mapNodeToRows,
	IntersectionRow
} from '@simra/intersections-common';



@Component({
	selector: 'chart-detail',
	imports: [CommonModule,Card, TableModule, ChartModule],
	templateUrl: './chart-detail.html',
	styleUrl: './chart-detail.scss',
})
export class ChartDetail<T extends IntersectionRow & NodeRow | EdgeRow>  {
	rows = input.required<T[]>();

	protected durationChartData = signal<any>(null);
	protected durationChartOptions = signal<any>(null);

	protected speedChartData = signal<any>(null);
	protected speedChartOptions = signal<any>(null);

	protected waitingTimeChartData = signal<any>(null);
	protected waitingTimeChartOptions = signal<any>(null);

	private createHistogram(data: number[], bucketSize: number, xLabel: string, yLabel: string) {
		const max = Math.max(...data);

		const bucketCount = Math.ceil(max / bucketSize);
		const buckets = new Array(bucketCount).fill(0);

		data.forEach(d => {
			const index = Math.max(Math.min(Math.floor(d / bucketSize), bucketCount - 1), 0);
			buckets[index]++;
		});

		const labels = buckets.map((_, i) => {
				const start = i * bucketSize;
				const end = start + bucketSize;
			return `${start}–${end}`;
  		});
	
		const result = {
			chart: {
				labels,
				datasets: [
				{
					// label: 'Number of Intersections',
					data: buckets
				}
				]
			},
			options: {
				responsive: true,
				plugins: {
				legend: {
					display: false
				}
				},
				scales: {
				x: {
					title: {
					display: true,
					text: xLabel
					}
				},
				y: {
					title: {
						display: true,
						text: yLabel
					},
						ticks: {
						precision: 0
					}
				}
				}
			}
		}
		return result;
	}

	constructor() {
		effect(() => {
			const rows = this.rows();
			if (rows && rows.length > 0) {
				const durationHistogram = this.createHistogram(rows.map(r => r.duration), 15, 'Duration (seconds)', 'Count')
				this.durationChartData.set(durationHistogram.chart);
				this.durationChartOptions.set(durationHistogram.options);

				const speedHistogram = this.createHistogram(rows.map(r => r.speed), 5, 'Speed (km/h)', 'Count')
				this.speedChartData.set(speedHistogram.chart);
				this.speedChartOptions.set(speedHistogram.options);

				const waitingTimeHistogram = this.createHistogram(rows.map(r => r.waitingTime), 15, 'WaitingTime (s)', 'Count')
				this.waitingTimeChartData.set(waitingTimeHistogram.chart);
				this.waitingTimeChartOptions.set(waitingTimeHistogram.options);
			} else {
				this.durationChartData.set([]);
				this.speedChartData.set([]);
				this.waitingTimeChartData.set([]);
			}
		});
	}
}
