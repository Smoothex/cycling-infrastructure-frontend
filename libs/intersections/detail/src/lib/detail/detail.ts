import { Component, effect, input, Input, signal, inject, numberAttribute } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { Feature, FeatureCollection, GeoJsonProperties, LineString, Point, Polygon } from 'geojson';
import { IntersectionsDetailFacade } from '@simra/intersections-domain';
import { ChartDetail } from '../../components/chart/chart-detail'
import { ListDetail } from '../../components/list/list-detail'
import { MapDetail } from '../../components/map/map-detail'

@Component({
	selector: 'detail',
	imports: [CommonModule, ChartDetail, ListDetail, MapDetail, Card, RouterLink],
	templateUrl: './detail.html',
	styleUrl: './detail.scss',
})
export class IntersectionsDetailPage {
	private readonly _intersectionsDetailFacade = inject(IntersectionsDetailFacade);
	displayNodes = input<boolean, string>(true, {
		transform: (value) => value === "node",
	});

	trafficSignalClusterId = input<number, string>(NaN, {
		transform: (value) => Number(value),
	});
	startOsmId = input<number | null, string>(null, {
		transform: (value) => value === 'null' ? null : Number(value),
	});
	endOsmId = input<number | null, string>(null, {
		transform: (value) => value === 'null' ? null : Number(value),
	});

	prevOsmId = input<number | null, string>(null, {
		transform: (value) => value === 'null' ? null : Number(value),
	});
	osmId = input<number | null, string>(null, {
		transform: (value) => value === 'null' ? null : Number(value),
	});
	nextOsmId = input<number | null, string>(null, {
		transform: (value) => value === 'null' ? null : Number(value),
	});

	intersectionData = signal<FeatureCollection<LineString> | undefined>(undefined);

	constructor() {
		effect(async () => {
			const displayNodes = this.displayNodes();
			if (this.displayNodes()) {
				if (!isNaN(this.trafficSignalClusterId())) {
					this.intersectionData.set(await this._intersectionsDetailFacade.getIntersectionNodeFiltered(this.trafficSignalClusterId(), this.startOsmId(), this.endOsmId()));
				}
			} else {
				this.intersectionData.set(await this._intersectionsDetailFacade.getIntersectionEdgeFiltered(this.prevOsmId(), this.osmId(), this.nextOsmId()));
			}
		});
	}
}
