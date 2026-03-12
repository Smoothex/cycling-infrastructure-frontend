import { Component, effect, input, computed, signal, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MapPage } from '@simra/common-components';
import { TableModule } from 'primeng/table';
import { FeatureCollection, LineString, Polygon } from 'geojson';
import { centroid } from '@turf/turf';
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
	displayRegions,
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
	templateUrl: './map.html',
	styleUrl: './map.scss',
	encapsulation: ViewEncapsulation.None,
})
export class IntersectionMap {
	private readonly _requestService = inject(IntersectionsRequestService);
	private readonly _router = inject(Router);
	private readonly _activatedRoute = inject(ActivatedRoute);
	private readonly queryParams = toSignal(this._activatedRoute.queryParams);

	public trafficSignalClusterId = input.required<number | undefined>();
	public baseData = input<FeatureCollection<LineString>>();
	public metricData = input<FeatureCollection<LineString>>();
	public regionData = input<FeatureCollection<Polygon>>();


	private intersectionDataAdded: addedOnMap = { sourceIds: [], layerIds: [], highlightLayerIds: [] };
	private ridePointsMatchedPointsAdded: addedOnMap = { sourceIds: [], layerIds: [], highlightLayerIds: [] };

	private readonly mapReady = signal<maplibregl.Map | null>(null);
	private readonly mapDataLoaded = signal(false);
	private readonly trafficSignalsLoaded = signal(false);
	
	protected selectedSegmentId = signal<number | null>(null);
	protected currentZoom = signal<number>(0);
	protected legendItems = computed<LegendItem[]>(() => {
		const zoom = this.currentZoom();
		const trafficSignalVisible: boolean = this.trafficSignalClusterId() ? true : false;
		const isMetricData: boolean = this.metricData() ? true : false;
		const isBaseData: boolean = this.baseData() ? true : false;
		const isRegionData: boolean = this.regionData() ? true : false;
		const selectedSegmentId: number | null = this.selectedSegmentId();

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
				label: 'Segment Median Wait Time [s] ∈ [0, 120]',
				geometry: 'line',
				colorStops: colorToStops(COLORS.waitingTime),
				showIf: isMetricData && zoom >= ZOOM_LEVELS.lines.minzoom
			},
			{
				label: 'Segment Number of Rides [#] ∈ [1, 50]',
				geometry: 'line',
				widthStops: [{ value: 0, width: 1 }, { value: 25, width: 4 }, { value: 50, width: 8 }],
				color: '#000000',
				showIf: isMetricData && zoom >= ZOOM_LEVELS.lines.minzoom
			},
			{
				label: `Segment Wait Time [s] ∈ [0, 120]`,
				geometry: 'line',
				colorStops: colorToStops(COLORS.waitingTime),
				showIf: isBaseData && zoom >= ZOOM_LEVELS.lines.minzoom
			},
			{
				label: `Segment ${selectedSegmentId}, GPS`,
				geometry: 'point',
				color: COLORS.ridePoints,
				showIf: isBaseData && selectedSegmentId !== null && zoom >= ZOOM_LEVELS.points.minzoom
			},
			{
				label: `Segment ${selectedSegmentId}, Matched Points`,
				geometry: 'point',
				color: COLORS.matchedPoints,
				showIf: isBaseData && selectedSegmentId !== null && zoom >= ZOOM_LEVELS.points.minzoom
			},
			{
				label: 'Region Intersection Wait Time [s/km] ∈ [0, 30]',
				geometry: 'polygon',
				colorStops: colorToStops(COLORS.regions),
				showIf: isRegionData
			},
			{
				label: 'Region Number of Rides [#] ∈ [1, 500]',
				geometry: 'line',
				widthStops: [{ value: 10, width: 1 }, { value: 50, width: 4 }, { value: 500, width: 8 }],
				color: '#000000',
				showIf: isRegionData
			}
		]);
  	});
  
	constructor() {
		effect(async () => {
			const trafficSignalClusterId = this.trafficSignalClusterId();
			const alreadyLoaded = this.trafficSignalsLoaded();
			const map = this.mapReady();

			if (!map || trafficSignalClusterId === undefined || alreadyLoaded) return;

			if (!isNaN(trafficSignalClusterId)) {
				const trafficSignalClusters = await this._requestService.getTrafficSignalClustersByTrafficSignalClusterId(trafficSignalClusterId);
				displayTrafficSignalClusters(map, trafficSignalClusters, false);

				const trafficSignals = await this._requestService.getTrafficSignalsByTrafficSignalClusterId(trafficSignalClusterId);
				displayTrafficSignals(map, trafficSignals);
			}

			this.trafficSignalsLoaded.set(true);
		});

		effect(async () => {
			const metricData = this.metricData();
			const baseData = this.baseData();
			const regionData = this.regionData();
			const trafficSignalsLoaded = this.trafficSignalsLoaded();
			const map = this.mapReady();

			if (!map || !trafficSignalsLoaded || !(metricData || baseData || regionData)) return;
			
			deleteDisplay(map, this.intersectionDataAdded);
			if (baseData) {
				deleteDisplay(map, this.ridePointsMatchedPointsAdded);
				zoomOnLineMidPoint(map, baseData);
				this.intersectionDataAdded = displayIntersection(this._router, baseData, map, "intersectionLineData");
			}
			if (metricData) {
				zoomOnLineMidPoint(map, metricData);
				this.intersectionDataAdded = displayIntersectionAggregate(this._router, metricData, map, "intersectionLineData");
			}
			if (regionData) {
				const polygonCentroid = centroid(regionData);
				map.jumpTo({ center: [polygonCentroid.geometry.coordinates[0], polygonCentroid.geometry.coordinates[1]], zoom: 9 });
				this.intersectionDataAdded = displayRegions(regionData, map, "region");
			}
			this.mapDataLoaded.set(true);
		});

		effect(() => {
			const map = this.mapReady();
			const params = this.queryParams();
			const dataLoaded = this.mapDataLoaded();

			const metricData = this.metricData();
			const baseData = this.baseData();
			if (!map || !dataLoaded || !params || !(metricData || baseData)) return;

			// Highlight line specified by query parameters
			const selectedId: number = Number(params["id"]);
    		const sourceId: string = params["sourceId"];
			if (!sourceId || !selectedId) {
				this.selectedSegmentId.set(null);
				return;
			}
			
			highlightLine(map, this.intersectionDataAdded, sourceId, selectedId);
			if (baseData) {
				this.selectedSegmentId.set(selectedId);
				this.displayRidePointsAndMatchedPoints(map, selectedId);
			}
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
   		deleteDisplay(map, this.ridePointsMatchedPointsAdded);
		mergeAdded(this.ridePointsMatchedPointsAdded, displayRidePoints(
			map, await this._requestService.getRidePointsIntersectionBase({id: intersectionId}), `ridePoints-${intersectionId}`));
		mergeAdded(this.ridePointsMatchedPointsAdded, displayMatchedPoints(
			map, await this._requestService.getMatchedPointsIntersectionBase({id: intersectionId}), `matchedPoints-${intersectionId}`));
	}
}
