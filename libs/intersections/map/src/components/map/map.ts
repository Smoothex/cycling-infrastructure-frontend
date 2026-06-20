import { Component, effect, input, computed, signal, inject, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MapPage } from '@simra/common-components';
import { TableModule } from 'primeng/table';
import { ProgressSpinner} from 'primeng/progressspinner'
import { FeatureCollection, LineString, Polygon } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import { IntersectionsRequestService } from '@simra/intersections-domain';
import {
	addedOnMap,
	colorToStops,
	COLORS,
	getWaitingTimeColors,
	displayTrafficSignalClusters,
	displayTrafficSignals,
	displayRideSegment,
	displayAggregateSegment,
	displayRidePoints,
	displayMatchedPoints,
	displayRegions,
	deleteDisplay,
	getVisibleLegendItems,
	highlightLine,
	LegendItem,
	removeLineHighlight,
	removeQueryParamsForLineHighlight,
	ZOOM_LEVELS,
	zoomTarget,
	BaseMetric,
	Base,
	REGION_SELECTABLE_PROPERTIES,
	getLabelFromOptions,
	BASE_METRIC_SELECTABLE_PROPERTIES,
	BASE_SELECTABLE_PROPERTIES,
	RegionMetric,
	SettingGroup,
	styleAggregateSegment,
	styleRideSegment,
	styleRegions,
	getAggrageteSegmentDefaults,
	getRideSegmentDefaults,
	getRegionDefaults
} from '@simra/intersections-common';
import { MapLegendComponent } from '../map-legend/map-legend';
import { MapSettingsComponent } from '../map-settings/map-settings';


@Component({
	selector: 'intersection-map',
	imports: [CommonModule, MapPage, TableModule, MapLegendComponent, MapSettingsComponent, ProgressSpinner],
	templateUrl: './map.html',
	styleUrl: './map.scss',
	encapsulation: ViewEncapsulation.None,
})
export class BaseIntersectionMapComponent {
	private readonly _requestService = inject(IntersectionsRequestService);
	private readonly _router = inject(Router);
	private readonly _activatedRoute = inject(ActivatedRoute);
	private readonly queryParams = toSignal(this._activatedRoute.queryParams);

	public trafficSignalClusterId = input.required<number | undefined>();
	public baseData = input<FeatureCollection<LineString>>();
	public metricData = input<FeatureCollection<LineString>>();
	public regionData = input<FeatureCollection<Polygon>>();
	public zoomTarget = input<zoomTarget>();

	public loading = input.required<boolean>();


	private intersectionDataAdded: addedOnMap | null = null;
	private ridePointsMatchedPointsAdded: addedOnMap[] = [];

	private readonly mapReady = signal<maplibregl.Map | null>(null);
	protected readonly mapDataLoaded = signal(false);
	private readonly trafficSignalsLoaded = signal(false);

	protected screenshotMode = signal<boolean>(false);


	protected aggregatedSegmentColorMax = signal<number>(getAggrageteSegmentDefaults().colorMax);
	protected aggregatedSegmentWidthMax = signal<number>(getAggrageteSegmentDefaults().widthMax); 
	protected aggregatedSegmentProperty = signal<keyof BaseMetric>(getAggrageteSegmentDefaults().colorProperty);
	protected rideSegmentColorMax = signal<number>(getRideSegmentDefaults().colorMax);
	protected rideSegmentProperty = signal<keyof Base>(getRideSegmentDefaults().colorProperty);
	protected regionColorMax = signal<number>(getRegionDefaults().colorMax);
	protected regionWidthMax = signal<number>(getRegionDefaults().widthMax); 
	protected regionProperty = signal<keyof RegionMetric>(getRegionDefaults().colorProperty);
	
	protected selectedSegmentId = signal<number | null>(null);
	protected currentZoom = signal<number>(0);
	protected legendItems = computed<LegendItem[]>(() => {
		const zoom = this.currentZoom();
		const trafficSignalVisible: boolean = this.trafficSignalClusterId() ? true : false;
		const isMetricData: boolean = this.metricData() ? true : false;
		const isBaseData: boolean = this.baseData() ? true : false;
		const isRegionData: boolean = this.regionData() ? true : false;
		const selectedSegmentId: number | null = this.selectedSegmentId();
		const aggColors = getWaitingTimeColors(this.aggregatedSegmentColorMax());
		const rideColors = getWaitingTimeColors(this.rideSegmentColorMax());
		const regionColors = getWaitingTimeColors(this.regionColorMax());
		const aggLabel = getLabelFromOptions(BASE_METRIC_SELECTABLE_PROPERTIES, this.aggregatedSegmentProperty());
		const rideLabel = getLabelFromOptions(BASE_SELECTABLE_PROPERTIES, this.rideSegmentProperty());
		const regionLabel = getLabelFromOptions(REGION_SELECTABLE_PROPERTIES, this.regionProperty());

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
				label: `Segment ${aggLabel} ∈ [${Object.keys(aggColors)[0]}, ${Object.keys(aggColors).at(-1)}]`,
				geometry: 'line',
				colorStops: colorToStops(aggColors),
				showIf: isMetricData && zoom >= ZOOM_LEVELS.lines.minzoom
			},
			{
				label: `Segment Number of Rides [#] ∈ [1, ${this.aggregatedSegmentWidthMax()}]`,
				geometry: 'line',
				widthStops: [{ value: 0, width: 1 }, { value: 25, width: 4 }, { value: 50, width: 8 }],
				color: '#000000',
				showIf: isMetricData && zoom >= ZOOM_LEVELS.lines.minzoom
			},
			{
				label: `Ride Segment ${rideLabel} ∈ [${Object.keys(rideColors)[0]}, ${Object.keys(rideColors).at(-1)}]`,
				geometry: 'line',
				colorStops: colorToStops(rideColors),
				showIf: isBaseData && zoom >= ZOOM_LEVELS.lines.minzoom
			},
			{
				label: `Ride Segment ${selectedSegmentId}, GPS`,
				geometry: 'point',
				color: COLORS.ridePoints,
				showIf: isBaseData && selectedSegmentId !== null && zoom >= ZOOM_LEVELS.points.minzoom
			},
			{
				label: `Ride Segment ${selectedSegmentId}, Matched Points`,
				geometry: 'point',
				color: COLORS.matchedPoints,
				showIf: isBaseData && selectedSegmentId !== null && zoom >= ZOOM_LEVELS.points.minzoom
			},
			{
				label: `Region ${regionLabel} ∈ [${Object.keys(regionColors)[0]}, ${Object.keys(regionColors).at(-1)}]`,
				geometry: 'polygon',
				colorStops: colorToStops(regionColors),
				showIf: isRegionData
			},
			{
				label: `Region Number of Rides [#] ∈ [1, ${this.regionWidthMax()}]`,
				geometry: 'line',
				widthStops: [{ value: 10, width: 1 }, { value: 50, width: 4 }, { value: 500, width: 8 }],
				color: '#000000',
				showIf: isRegionData
			}
		]);
  	});

	MapSettingsComponent = computed<SettingGroup[]>(() => {
		const settings: SettingGroup[] = [];
		if (this.metricData()) (
			settings.push({
				group: 'Metric Segments', items: [
					{ label: 'Maximum Color', props: { type: "number", value: this.aggregatedSegmentColorMax }},
					{ label: 'Maximum Width', props: { type: "number", value: this.aggregatedSegmentWidthMax }},
					{ label: 'Property', props: { type: "select", value: this.aggregatedSegmentProperty, options: BASE_METRIC_SELECTABLE_PROPERTIES }},
				]
			})
		)
		if (this.baseData()) (
			settings.push({
				group: 'Segments', items: [
					{ label: 'Maximum Color', props: { type: "number", value: this.rideSegmentColorMax }},
					{ label: 'Property', props: { type: "select", value: this.rideSegmentProperty, options: BASE_SELECTABLE_PROPERTIES }},
				]
			})
		)
		if (this.regionData()) (
			settings.push({
				group: 'Regions', items: [
					{ label: 'Maximum Color', props: { type: "number", value: this.regionColorMax }},
					{ label: 'Maximum Width', props: { type: "number", value: this.regionWidthMax }},
					{ label: 'Property', props: { type: "select", value: this.regionProperty, options: REGION_SELECTABLE_PROPERTIES }},
				]
			})
		)
		return settings;
	});
  
	constructor() {
		effect(async () => {
			const zoomProps = this.zoomTarget();
			const map = this.mapReady();

			if (!map || !zoomProps) return;

			const target = { center: [zoomProps.lng, zoomProps.lat] as maplibregl.LngLatLike, zoom: zoomProps.zoom };
			map.setCenter(target.center);
			map.jumpTo(target);
		});

		effect(async () => {
			const trafficSignalClusterId = this.trafficSignalClusterId();
			const alreadyLoaded = this.trafficSignalsLoaded();
			const map = this.mapReady();

			if (!map || trafficSignalClusterId === undefined || alreadyLoaded) return;

			if (!isNaN(trafficSignalClusterId)) {
				const trafficSignalClusters = await this._requestService.getTrafficSignalClustersByTrafficSignalClusterId(trafficSignalClusterId);
				displayTrafficSignalClusters(map, trafficSignalClusters);

				const trafficSignals = await this._requestService.getTrafficSignalsByTrafficSignalClusterId(trafficSignalClusterId);
				displayTrafficSignals(map, trafficSignals);
			}

			this.trafficSignalsLoaded.set(true);
		});


		
		effect(async () => {
			removeQueryParamsForLineHighlight(this._router);
			const metricData = this.metricData();
			const baseData = this.baseData();
			const regionData = this.regionData();
			const trafficSignalsLoaded = this.trafficSignalsLoaded();
			const map = this.mapReady();
			if (!map || !trafficSignalsLoaded || !(metricData || baseData || regionData)) return;
			if (this.intersectionDataAdded) deleteDisplay(map, this.intersectionDataAdded);
			if (baseData) {
				this.ridePointsMatchedPointsAdded.forEach(el => deleteDisplay(map, el));
				this.intersectionDataAdded = displayRideSegment(this._router, baseData, map, "intersectionLineData", true);
			}
			else if (metricData) {
				this.intersectionDataAdded = displayAggregateSegment(this._router, metricData, map, "intersectionLineData", true);
			}
			else if (regionData) {
				this.intersectionDataAdded = displayRegions(regionData, map, "region");
			}
			this.mapDataLoaded.set(true);
		});

		effect(() => {
			const map = this.mapReady();
			const metric = this.metricData();
			const c = this.aggregatedSegmentColorMax();
			const p = this.aggregatedSegmentProperty();
			const w = this.aggregatedSegmentWidthMax();
			if (!map || !metric || !this.intersectionDataAdded) return;
			styleAggregateSegment(map, this.intersectionDataAdded, this._router, p, c, w, true);
		})

		effect(() => {
			const map = this.mapReady();
			const base = this.baseData();
			const c = this.rideSegmentColorMax();
			const p = this.rideSegmentProperty();
			if (!map || !base || !this.intersectionDataAdded) return;
			styleRideSegment(map, this.intersectionDataAdded, this._router, p, c, true);
		})

		effect(() => {
			const map = this.mapReady();
			const region = this.regionData();
			const c = this.regionColorMax();
			const p = this.regionProperty();
			const w = this.regionWidthMax();
			if (!map || !region || !this.intersectionDataAdded) return;
			styleRegions(map, this.intersectionDataAdded, p, c, w);
		})

		effect(() => {
			const map = this.mapReady();
			const params = this.queryParams();
			const dataLoaded = this.mapDataLoaded();

			const metricData = this.metricData();
			const baseData = this.baseData();
			if (!map || !dataLoaded || !params || !(metricData || baseData)) return;

			// Highlight line specified by query parameters
			const selectedId = Number(params["id"]);
    		const sourceId: string = params["sourceId"];
			if (!sourceId || !selectedId) {
				this.selectedSegmentId.set(null);
				return;
			}
			
			if (this.intersectionDataAdded) highlightLine(map, this.intersectionDataAdded, sourceId, selectedId);
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
				if (this.intersectionDataAdded) removeLineHighlight(map, this.intersectionDataAdded);
				this.ridePointsMatchedPointsAdded.forEach(el => deleteDisplay(map, el));
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
   		this.ridePointsMatchedPointsAdded.forEach(el => deleteDisplay(map, el));
		const ridePoints = displayRidePoints(
			map, await this._requestService.getRidePointsIntersectionBase({id: intersectionId}), `ridePoints-${intersectionId}`);
		const matchedPoints = displayMatchedPoints(
			map, await this._requestService.getMatchedPointsIntersectionBase({id: intersectionId}), `matchedPoints-${intersectionId}`);
		this.ridePointsMatchedPointsAdded = [ridePoints, matchedPoints];
	}
}
