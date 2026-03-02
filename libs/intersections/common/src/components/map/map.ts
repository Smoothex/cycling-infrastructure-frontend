import { Component, effect, input, computed, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MapPage } from '@simra/common-components';
import { TableModule } from 'primeng/table';
import { FeatureCollection, LineString } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import { IntersectionsRequestService } from '@simra/intersections-domain';
import {
	addedOnMap,
	colorToStops,
	COLORS,
	displayTrafficSignalClusters,
	displayTrafficSignals,
	displayIntersection,
	displayIntersectionAggregate,
	displayRidePoints,
	displayMatchedPoints,
	deleteDisplay,
	getVisibleLegendItems,
	highlightLine,
	LegendItem,
	MapLegend,
	mergeAdded,
	removeLineHighlight,
	removeQueryParamsForLineHighlight,
	zoomOnLineMidPoint,
	ZOOM_LEVELS
} from '@simra/intersections-common';


@Component({
	selector: 'intersection-map',
	imports: [CommonModule, MapPage, TableModule, MapLegend],
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
	
	protected selectedRideId = signal<number | null>(null);
	protected currentZoom = signal<number>(0);
	protected legendItems = computed<LegendItem[]>(() => {
		const zoom = this.currentZoom();
		const trafficSignalVisible: boolean = this.trafficSignalClusterId() ? true : false;
		const isAggregateData: boolean = this.isAggregateData();
		const selectedRideId: number | null = this.selectedRideId();

		return getVisibleLegendItems([
			{
				label: 'Traffic Signal',
				geometry: 'point',
				color: COLORS.trafficSignals,
				showIf: trafficSignalVisible && zoom >= ZOOM_LEVELS.points.minzoom
			},
			{
				label: 'Traffic Signal Intersection',
				geometry: 'polygon',
				color: COLORS.trafficSignalClusters,
				showIf: trafficSignalVisible && zoom >= ZOOM_LEVELS.polygons.minzoom
			},
			{
				label: 'Segment Median Wait Time [s] ∈ ]0, 120[',
				geometry: 'line',
				colorStops: colorToStops(COLORS.waitingTime),
				showIf: isAggregateData && zoom >= ZOOM_LEVELS.lines.minzoom
			},
			{
				label: 'Segment Number of Rides [#] ∈ [1, 50[',
				geometry: 'line',
				widthStops: [{ value: 0, width: 1 }, { value: 25, width: 4 }, { value: 50, width: 8 }],
				color: '#000000',
				showIf: isAggregateData && zoom >= ZOOM_LEVELS.lines.minzoom
			},
			{
				label: `Segment Wait Time [s] ∈ ]0, 120[`,
				geometry: 'line',
				colorStops: colorToStops(COLORS.waitingTime),
				showIf: !isAggregateData && zoom >= ZOOM_LEVELS.lines.minzoom
			},
			{
				label: `Ride ${selectedRideId}, GPS`,
				geometry: 'point',
				color: COLORS.ridePoints,
				showIf: !isAggregateData && selectedRideId !== null && zoom >= ZOOM_LEVELS.points.minzoom
			},
			{
				label: `Ride ${selectedRideId}, Matched Points`,
				geometry: 'point',
				color: COLORS.matchedPoints,
				showIf: !isAggregateData && selectedRideId !== null && zoom >= ZOOM_LEVELS.points.minzoom
			}
		]);
  	});
  
	constructor() {
		effect(async () => {
			const trafficSignalClusterId = this.trafficSignalClusterId();
			const map = this.mapReady();
			if (!map || this.trafficSignalsLoaded()) return;

			if (!isNaN(trafficSignalClusterId)) {
				const trafficSignalClusters = await this._requestService.getTrafficSignalClustersByTrafficSignalClusterId(trafficSignalClusterId);
				displayTrafficSignalClusters(map, trafficSignalClusters, false);

				const trafficSignals = await this._requestService.getTrafficSignalsByTrafficSignalClusterId(trafficSignalClusterId);
				displayTrafficSignals(map, trafficSignals);
			}

			this.trafficSignalsLoaded.set(true);
		});

		effect(async () => {
			const data = this.intersectionData();
			const map = this.mapReady();
			if (!data || !map || !this.trafficSignalsLoaded()) return;

			deleteDisplay(map, this.ridePointsMatchedPointsAdded);
			deleteDisplay(map, this.intersectionDataAdded);
			zoomOnLineMidPoint(map, data);
			if (this.isAggregateData()) {
				this.intersectionDataAdded = displayIntersectionAggregate(this._router, data, map, "intersectionLineData");
			} else {
				this.intersectionDataAdded = displayIntersection(this._router, data, map, "intersectionLineData");
			}
			this.mapDataLoaded.set(true);
		});

		effect(() => {
			const map = this.mapReady();
			const params = this.queryParams();
			const dataLoaded = this.mapDataLoaded();
			if (!map || !dataLoaded || !params) return;

			// Highlight line specified by query parameters
			const selectedId: number = Number(params["id"]);
    		const sourceId: string = params["sourceId"];
			if (!sourceId || !selectedId) {
				this.selectedRideId.set(null);
				return;
			}
			this.selectedRideId.set(selectedId);
			highlightLine(map, this.intersectionDataAdded, sourceId, selectedId);
			this.displayRidePointsAndMatchedPoints(map, selectedId);
		})

		effect(() => {
			const dataLoaded = this.mapDataLoaded();
			const map = this.mapReady();
			if (!map || !dataLoaded) return;
			map.on('dblclick', () => {
				removeQueryParamsForLineHighlight(this._router);
				removeLineHighlight(map, this.intersectionDataAdded);
				deleteDisplay(map, this.ridePointsMatchedPointsAdded);
			});

			this.currentZoom.set(map.getZoom());
			map.on('zoom', () => {
				this.currentZoom.set(map.getZoom());
			})
		})
	}

	onMapReady(mlMap: maplibregl.Map) {
		this.mapReady.set(mlMap);
	}

	async displayRidePointsAndMatchedPoints(map: maplibregl.Map, intersectionId: number) {
		if (!this.isAggregateData()) return;
   		deleteDisplay(map, this.ridePointsMatchedPointsAdded);
		mergeAdded(this.ridePointsMatchedPointsAdded, displayRidePoints(
			map, await this._requestService.getRidePointsIntersectionBase({id: intersectionId}), `ridePoints-${intersectionId}`));
		mergeAdded(this.ridePointsMatchedPointsAdded, displayMatchedPoints(
			map, await this._requestService.getMatchedPointsIntersectionBase({id: intersectionId}), `matchedPoints-${intersectionId}`));
	}
}
