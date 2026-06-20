import { CommonModule } from '@angular/common';
import { Component, input, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Card } from 'primeng/card';
import { LegendItem } from '@simra/intersections-common';


@Component({
	selector: 'intersection-map-legend',
	imports: [
		CommonModule,
		FormsModule,
		Card
	],
	templateUrl: './map-legend.html',
	styleUrl: './map-legend.scss',
	encapsulation: ViewEncapsulation.None
})
export class MapLegendComponent {
	items = input.required<LegendItem[]>();

	gradient(stops: { value: number; color: string }[]): string {
		const min = stops[0].value;
		const max = stops.at(-1)!.value;

  		return `linear-gradient(to right, ${stops
			.map(s => {
				const pct = ((s.value - min) / (max - min)) * 100;
				return `${s.color} ${pct}%`;
			}).join(', ')})`;
	}

	getClassForGeometry(item: LegendItem): string {
		if (item.geometry === 'point') {
			return 'legend-shape-point rounded-full';
		}
		if (item.geometry === 'polygon') {
			return 'legend-shape-polygon rounded';
		}
		if (item.geometry === 'line') {
			return 'legend-shape-line rounded';
		}
		return '';
	}

	getColorForGeometry(item: LegendItem): string {
		if (item.color) {
			return item.color;
		}
		if (item.colorStops) {
			return this.gradient(item.colorStops);
		}
		return '';
	}
}
