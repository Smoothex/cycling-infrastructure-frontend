import { Component, effect, input, Input, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { Divider } from 'primeng/divider';
import { Skeleton } from 'primeng/skeleton';
import { Feature, FeatureCollection, GeoJsonProperties, LineString, Point, Polygon } from 'geojson';
import { centroid } from '@turf/turf';
import { EPin, MapPage, MapUtils } from '@simra/common-components';
import {
	displayPolygons,
	RegionAggregateRow,
	mapIntersectionRegionAggregateToRows,
	displayRegions
} from '@simra/intersections-common';
import { IntersectionsRegionFacade } from '@simra/intersections-domain';


@Component({
	selector: 'overview',
	imports: [CommonModule, Card, TableModule, Divider, Skeleton, MapPage],
	templateUrl: './overview.html',
	styleUrl: './overview.scss',
})
export class OverviewRegionDetail {
	regionAggregate = input<FeatureCollection<Polygon, GeoJsonProperties> | undefined>();
	regionName = input<string>();
	protected readonly row = signal<RegionAggregateRow | undefined>(undefined);

	private readonly mapReady = signal<maplibregl.Map | null>(null);
	map: maplibregl.Map | undefined;


	constructor() {
		effect(() => {
			const regionName = this.regionName();
			const regionPolygon = this.regionAggregate();
			if (!regionName || !this.mapReady() || !this.map || !regionPolygon) return;

			displayRegions(regionPolygon, this.map, "region");
			const polygonCentroid = centroid(regionPolygon);
			this.map.jumpTo({ center: [polygonCentroid.geometry.coordinates[0], polygonCentroid.geometry.coordinates[1]], zoom: 10 });

			const row = mapIntersectionRegionAggregateToRows(regionPolygon);
			if (row.length === 1) {
				this.row.set(row[0]);
			}
		});
	}

	onMapReady(mlMap: maplibregl.Map) {
		this.map = mlMap;
		this.mapReady.set(mlMap);
	}
}
