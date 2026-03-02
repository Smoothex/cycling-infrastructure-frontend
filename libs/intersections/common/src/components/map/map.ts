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
	deleteDisplay,
	highlightLine,
	mergeAdded,
	removeLineHighlight,
	removeQueryParamsForLineHighlight,
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
	private ridePointsMatchedPointsAdded: addedOnMap = { sourceIds: [], layerIds: [], highlightLayerIds: [] };


	private readonly mapReady = signal<maplibregl.Map | null>(null);
	private readonly mapDataLoaded = signal(false);
	private readonly trafficSignalsLoaded = signal(false);
	map: maplibregl.Map | undefined;



	constructor() {
		effect(async () => {
			const trafficSignalClusterId = this.trafficSignalClusterId();
			if (!this.mapReady() || !this.map) return;

			if (!isNaN(trafficSignalClusterId)) {
				const trafficSignalClusters = await this._requestService.getTrafficSignalClustersByTrafficSignalClusterId(trafficSignalClusterId);
				displayTrafficSignalClusters(this.map, trafficSignalClusters, false);

				const trafficSignals = await this._requestService.getTrafficSignalsByTrafficSignalClusterId(trafficSignalClusterId);
				displayTrafficSignals(this.map, trafficSignals);
			}

			this.trafficSignalsLoaded.set(true);
		});

		effect(async () => {
			const data = this.intersectionData();
			if (!data || !this.mapReady() || !this.map || !this.trafficSignalsLoaded()) return;

			deleteDisplay(this.map, this.ridePointsMatchedPointsAdded);
			deleteDisplay(this.map, this.intersectionDataAdded);
			zoomOnLineMidPoint(this.map, data);
			if (this.isAggregateData()) {
				this.intersectionDataAdded = displayIntersectionAggregate(this._router, data, this.map, "intersectionLineData");
			} else {
				this.intersectionDataAdded = displayIntersection(this._router, data, this.map, "intersectionLineData");
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
			if (!sourceId || !selectedId) return;
			highlightLine(this.map, this.intersectionDataAdded, sourceId, selectedId);
			if (!this.isAggregateData()) {
				this.displayRidePointsAndMatchedPoints(selectedId);
			}
		})

		effect(() => {
			const dataLoaded = this.mapDataLoaded();
			if (!this.map || !dataLoaded) return;
			this.map.on('dblclick', e => {
				removeQueryParamsForLineHighlight(this._router);
				if (!this.map) return;
				removeLineHighlight(this.map, this.intersectionDataAdded);
				deleteDisplay(this.map, this.ridePointsMatchedPointsAdded);
			});
		})
	}

	onMapReady(mlMap: maplibregl.Map) {
		this.map = mlMap;
		this.mapReady.set(mlMap);
	}

	async displayRidePointsAndMatchedPoints(intersectionId: number) {
		if (!this.map) return;
   		deleteDisplay(this.map, this.ridePointsMatchedPointsAdded);
		mergeAdded(this.ridePointsMatchedPointsAdded, displayRidePoints(
			this.map, await this._requestService.getRidePointsIntersectionBase({id: intersectionId}), `ridePoints-${intersectionId}`));
		mergeAdded(this.ridePointsMatchedPointsAdded, displayMatchedPoints(
			this.map, await this._requestService.getMatchedPointsIntersectionBase({id: intersectionId}), `matchedPoints-${intersectionId}`));
	}
}
