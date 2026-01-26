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
	displayIntersectionAggregate,
	highlightLineFromQueryParams,
	renameProperty
} from '@simra/intersections-common';

@Component({
	selector: 'map-aggregate',
	imports: [CommonModule, MapPage, TableModule],
	templateUrl: './map-aggregate.html'
})
export class IntersectionsAggregateMap {
	private readonly _intersectionsAggregateFacade = inject(IntersectionsAggregateFacade);
	private readonly _router = inject(Router);
	private readonly _activatedRoute = inject(ActivatedRoute);
	private readonly queryParams = toSignal(this._activatedRoute.queryParams);

	@Input({required: true}) trafficSignalClusterId!: number;
	intersectionNodeAggregate = input<FeatureCollection<LineString> | undefined>();
	
	private readonly mapReady = signal<maplibregl.Map | null>(null);
	private readonly mapDataLoaded = signal(false);
	map: maplibregl.Map | undefined;


	constructor() {
		effect(async () => {
			const data = this.intersectionNodeAggregate();
			if (!data || !this.mapReady() || !this.map) return;
			
			await loadAndDisplayTrafficSignalPolygonsByTrafficSignalClusterId(this._intersectionsAggregateFacade, this.map, this.trafficSignalClusterId);
			await loadDisplayAndZoomTrafficSignalsByTrafficSignalClusterId(this._intersectionsAggregateFacade, this.map, this.trafficSignalClusterId);
			
			renameProperty(data, "example_id", "id");
			displayIntersectionAggregate(this._router, data, this.map, "intersectionNodeAggregate");
			this.mapDataLoaded.set(true);
		});

		effect(() => {
			const params = this.queryParams();
			const dataLoaded = this.mapDataLoaded();
			if (!this.map ||  !dataLoaded || !params) return;

			// Highlight line specified by query parameters
			highlightLineFromQueryParams(params, this.map);
		})
	}

	onMapReady(mlMap: maplibregl.Map) {
		this.map = mlMap;
		this.mapReady.set(mlMap);
	}
}
