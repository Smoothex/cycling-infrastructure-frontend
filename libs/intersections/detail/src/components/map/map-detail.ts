import { Component, effect, input, Input, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { EPin, MapPage, MapUtils } from '@simra/common-components';
import { TableModule } from 'primeng/table';
import { Feature, FeatureCollection, GeoJsonProperties, LineString, Point, Polygon } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import { IntersectionsAggregateFacade } from '@simra/intersections-domain';
import {
	loadAndDisplayTrafficSignalPolygonsByTrafficSignalClusterId,
	loadDisplayAndZoomTrafficSignalsByTrafficSignalClusterId,
	displayIntersection,
	highlightLineFromQueryParams,
	zoomOnLineMidPoint
} from '@simra/intersections-common';


@Component({
	selector: 'map-detail',
	imports: [CommonModule, MapPage, TableModule],
	templateUrl: './map-detail.html'
})
export class MapDetail {
	private readonly _intersectionsAggregateFacade = inject(IntersectionsAggregateFacade);
	private readonly _router = inject(Router);
	private readonly _activatedRoute = inject(ActivatedRoute);
	private readonly queryParams = toSignal(this._activatedRoute.queryParams);

	@Input({required: true}) displayNodes!: boolean;
	@Input({required: true}) trafficSignalClusterId!: number;
	intersectionData = input<FeatureCollection<LineString> | undefined>();

	private readonly mapReady = signal<maplibregl.Map | null>(null);
	private readonly mapDataLoaded = signal(false);
	map: maplibregl.Map | undefined;



	constructor() {
		effect(async () => {
			const data = this.intersectionData();
			if (!data || !this.mapReady() || !this.map) return;

			if (!isNaN(this.trafficSignalClusterId)) {
				await loadAndDisplayTrafficSignalPolygonsByTrafficSignalClusterId(this._intersectionsAggregateFacade, this.map, this.trafficSignalClusterId);
				await loadDisplayAndZoomTrafficSignalsByTrafficSignalClusterId(this._intersectionsAggregateFacade, this.map, this.trafficSignalClusterId);
			} else {
				zoomOnLineMidPoint(this.map, data);
			}

			displayIntersection(this._router, data, this.map, "intersectionLineData");
			this.mapDataLoaded.set(true);
		});

		effect(() => {
			const params = this.queryParams();
			const dataLoaded = this.mapDataLoaded();
			if (!this.map || !dataLoaded || !params) return;

			// Highlight line specified by query parameters
			highlightLineFromQueryParams(params, this.map);	
		})
	}

	onMapReady(mlMap: maplibregl.Map) {
		this.map = mlMap;
		this.mapReady.set(mlMap);
	}
}
