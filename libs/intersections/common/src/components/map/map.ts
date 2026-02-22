import { Component, effect, input, Input, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { EPin, MapPage, MapUtils } from '@simra/common-components';
import { TableModule } from 'primeng/table';
import { Feature, FeatureCollection, GeoJsonProperties, LineString, Point, Polygon } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import { IntersectionsRequestService } from '@simra/intersections-domain';
import {
	addedOnMap,
	displayTrafficSignalClusters,
	displayTrafficSignals,
	displayIntersection,
	displayIntersectionAggregate,
	displayRidePoints,
	displayMatchedPoints,
	highlightLine,
	zoomOnLineMidPoint
} from '@simra/intersections-common';


@Component({
	selector: 'intersection-map',
	imports: [CommonModule, MapPage, TableModule],
	templateUrl: './map.html'
})
export class IntersectionMap {
	private readonly _requestService = inject(IntersectionsRequestService);
	private readonly _router = inject(Router);
	private readonly _activatedRoute = inject(ActivatedRoute);
	private readonly queryParams = toSignal(this._activatedRoute.queryParams);

	public trafficSignalClusterId = input.required<number>();
	public isAggregateData = input.required<boolean>();
	public intersectionData = input.required<FeatureCollection<LineString> | undefined>();
	private intersectionDataAdded: addedOnMap = { sourceIds: [], layerIds: [], highlightLayerIds: [] };

	private readonly mapReady = signal<maplibregl.Map | null>(null);
	private readonly mapDataLoaded = signal(false);
	map: maplibregl.Map | undefined;



	constructor() {
		effect(async () => {
			const data = this.intersectionData();
			if (!data || !this.mapReady() || !this.map) return;

			zoomOnLineMidPoint(this.map, data);

			const trafficSignalClusterId = this.trafficSignalClusterId();
			if (!isNaN(trafficSignalClusterId)) {
				const trafficSignalClusters = await this._requestService.getTrafficSignalClustersByTrafficSignalClusterId(trafficSignalClusterId);
				displayTrafficSignalClusters(this.map, trafficSignalClusters, false);

				const trafficSignals = await this._requestService.getTrafficSignalsByTrafficSignalClusterId(trafficSignalClusterId);
				displayTrafficSignals(this.map, trafficSignals);
			}

			if (this.isAggregateData()) {
				this.intersectionDataAdded = displayIntersectionAggregate(this._router, data, this.map, "intersectionLineData");
			} else {
				this.intersectionDataAdded = displayIntersection(this._router, data, this.map, "intersectionLineData");
				const firstId = data.features[0].properties?.["id"];
				// TODO: use selected id instead of 0

				const matchedPoints = await this._requestService.getMatchedPointsIntersectionBase({id: firstId});
				displayMatchedPoints(this.map, matchedPoints, "matchedPoints");

				const ridePoints = await this._requestService.getRidePointsIntersectionBase({id: firstId});
				displayRidePoints(this.map, ridePoints, "ridePoints");

			}
			this.mapDataLoaded.set(true);
		});

		effect(() => {
			const params = this.queryParams();
			const dataLoaded = this.mapDataLoaded();
			if (!this.map || !dataLoaded || !params) return;

			// Highlight line specified by query parameters
			const selectedId: number = Number(params["id"]);
    		const sourceId: string = params["sourceId"];
			highlightLine(this.map, this.intersectionDataAdded, sourceId, selectedId);	
		})
	}

	onMapReady(mlMap: maplibregl.Map) {
		this.map = mlMap;
		this.mapReady.set(mlMap);
	}
}
