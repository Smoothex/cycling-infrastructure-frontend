import {
	Component,
	computed,
	effect,
	inject,
  Inject,
	signal,
  untracked,
  ViewEncapsulation
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { MapPage } from '@simra/common-components';
import { IntersectionsRequestService } from '@simra/intersections-domain';
import * as maplibregl from 'maplibre-gl';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import {
  addedOnMap,
  BaseMetric,
  colorToStops,
  COLORS,
  getWaitingTimeColors,
	displayTrafficSignalsVectorTiles,
	displayTrafficSignalClustersVectorTiles,
	displayRideSegment,
  displayAggregateSegmentVectorTiles,
  displayMatchedPoints,
  displayRidePoints,
  displayRegions,
  getVisibleLegendItems,
	highlightLine,
  LegendItem,
  MapLegend,
  MapSettings,
  removeLineHighlight,
  removeQueryParamsForLineHighlight,
  deleteDisplay,
  MetricRequest,
  ZOOM_LEVELS,
  SettingGroup,
  TimeCategory,
  recordToOptions,
  BASE_METRIC_SELECTABLE_PROPERTIES,
  Base,
  BASE_SELECTABLE_PROPERTIES,
  RegionMetric,
  REGION_SELECTABLE_PROPERTIES,
  getLabelFromOptions,
  getAggrageteSegmentDefaults,
  styleAggregateSegment,
  styleRegions,
  getRideSegmentDefaults,
  getRegionDefaults,
  styleRideSegment
} from '@simra/intersections-common';
import {
	TRAFFIC_TIMES_TO_TRANSLATION,
	WEEK_DAYS_TO_TRANSLATION, 
	YEAR_TO_TRANSLATION
} from '@simra/common-components';
import { APP_CONFIG, AppEnvironmentInterface, ETrafficTimes, EWeekDays, EYear } from '@simra/common-models';
import { TranslateService } from '@ngx-translate/core';

const TimeCatergoryLabelTranslations: Record<TimeCategory, any> = {
  trafficTime: TRAFFIC_TIMES_TO_TRANSLATION,
  weekDay: WEEK_DAYS_TO_TRANSLATION,
  year: YEAR_TO_TRANSLATION,
}


@Component({
	selector: 'lib-map',
	imports: [CommonModule, MapPage, FormsModule, CheckboxModule, SelectModule, MapSettings, MapLegend],
	templateUrl: './map.html',
  styleUrl: './map.scss',
  encapsulation: ViewEncapsulation.None,
})
export class IntersectionsMap {
  private readonly _requestService = inject(IntersectionsRequestService);
  private readonly _router = inject(Router);
  private readonly _activatedRoute = inject(ActivatedRoute);
	private readonly queryParams = toSignal(this._activatedRoute.queryParams);
  private readonly queryId = signal<number | undefined>(undefined);
  private readonly querySourceId = signal<string | undefined>(undefined);

  private map = signal<maplibregl.Map | undefined>(undefined);
  private flyToRide = true;

  private rideAdded = signal<addedOnMap[]>([]);
  private edgeMetricsAdded: addedOnMap | null = null;
  private nodeMetricsAdded: addedOnMap | null = null;
  private regionsAdded: addedOnMap[] = [];
  private trafficSignalsAdded: addedOnMap[] = [];

  protected screenshotMode = signal<boolean>(false);

  protected aggregatedSegmentNumberOfRides = signal<number>(3);
  protected aggregatedSegmentColorMax = signal<number>(getAggrageteSegmentDefaults().colorMax);
  protected aggregatedSegmentWidthMax = signal<number>(getAggrageteSegmentDefaults().widthMax); 
  protected aggregatedSegmentProperty = signal<keyof BaseMetric>(getAggrageteSegmentDefaults().colorProperty);
  protected rideSegmentColorMax = signal<number>(getRideSegmentDefaults().colorMax);
  protected rideSegmentProperty = signal<keyof Base>(getRideSegmentDefaults().colorProperty);
  protected regionNumberOfRides = signal<number>(10);
  protected regionColorMax = signal<number>(getRegionDefaults().colorMax);
  protected regionWidthMax = signal<number>(getRegionDefaults().widthMax); 
  protected regionProperty = signal<keyof RegionMetric>(getRegionDefaults().colorProperty);

  protected selectedRideId = signal<number | null>(null); // TODO: fix deleting initial ride
  protected showIntersectionMetrics = signal<boolean>(true);
  protected showTrafficSignals = signal<boolean>(true);
  protected selectedTrafficTime = signal<ETrafficTimes>(ETrafficTimes.ALL_DAY);
  protected selectedWeekDay = signal<EWeekDays>(EWeekDays.ALL_WEEK);
  protected selectedYear = signal<EYear>(EYear.ALL);
  

  protected readonly metricSegmentRequestFilter = computed<MetricRequest>(() => ({
    numberOfRides: this.aggregatedSegmentNumberOfRides(),
    trafficTime: this.selectedTrafficTime(),
    weekDay: this.selectedWeekDay(),
    year: this.selectedYear()
  }));
  protected readonly regionRequestFilter = computed<MetricRequest>(() => ({
    numberOfRides: this.regionNumberOfRides(),
    trafficTime: this.selectedTrafficTime(),
    weekDay: this.selectedWeekDay(),
    year: this.selectedYear()
  }));

  protected currentZoom = signal<number>(0);
  protected legendItems = computed<LegendItem[]>(() => {
    const zoom = this.currentZoom();
    const trafficSignalVisible: boolean = this.showTrafficSignals();
    const metricsVisible: boolean = this.showIntersectionMetrics();
    const selectedRideId: number | null = this.selectedRideId();
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
        showIf: metricsVisible && zoom >= ZOOM_LEVELS.lines.minzoom
      },
      {
        label: `Segment Number of Rides [#] ∈ [${this.aggregatedSegmentNumberOfRides()}, ${this.aggregatedSegmentWidthMax()}]`,
        geometry: 'line',
        widthStops: [{ value: 0, width: 1 }, { value: 25, width: 4 }, { value: 50, width: 8 }],
        color: '#000000',
        showIf: metricsVisible && zoom >= ZOOM_LEVELS.lines.minzoom
      },
      {
        label: `Region ${regionLabel} ∈ [${Object.keys(regionColors)[0]}, ${Object.keys(regionColors).at(-1)}]`,
        geometry: 'polygon',
        colorStops: colorToStops(regionColors),
        showIf: zoom < ZOOM_LEVELS.regions.maxzoom
      },
      {
        label: `Region Number of Rides [#] ∈ [${this.regionNumberOfRides()}, ${this.regionWidthMax()}]`,
        geometry: 'line',
        widthStops: [{ value: 10, width: 1 }, { value: 50, width: 4 }, { value: 500, width: 8 }],
        color: '#000000',
        showIf: zoom < ZOOM_LEVELS.regions.maxzoom
      },
      {
        label: `Ride ${selectedRideId}, GPS`,
        geometry: 'point',
        color: COLORS.ridePoints,
        showIf: selectedRideId != null && zoom >= ZOOM_LEVELS.points.minzoom
      },
      {
        label: `Ride ${selectedRideId}, Matched Points`,
        geometry: 'point',
        color: COLORS.matchedPoints,
        showIf: selectedRideId != null && zoom >= ZOOM_LEVELS.points.minzoom
      },
      {
        label: `Ride ${selectedRideId}, Segment ${rideLabel} ∈ [${Object.keys(rideColors)[0]}, ${Object.keys(rideColors).at(-1)}]`,
        geometry: 'line',
        colorStops: colorToStops(rideColors),
        showIf: selectedRideId != null && zoom >= ZOOM_LEVELS.lines.minzoom
      }
    ]);
  });

  getTimeCategoryOptions(timeCategory: TimeCategory) {
    const translation = TimeCatergoryLabelTranslations[timeCategory];
    const labelMap: Record<string, string> = {};
    for (const [key, value] of Object.entries(translation)) {
      labelMap[key] = this.translate.instant((value as any).label);
    }
    return labelMap;
  }

  mapSettings = computed<SettingGroup[]>(() => [
    {
      group: 'Display', items: [
        { label: 'Show Traffic Signals', props: { type: "boolean", value: this.showTrafficSignals }},
        { label: 'Show Metric Segments', props: { type: "boolean", value: this.showIntersectionMetrics }},
      ]
    },
    {
      group: 'Metric Segments', items: [
        { label: 'Show Metric Segments', props: { type: "boolean", value: this.showIntersectionMetrics }},
        { label: 'Minimum Number of Rides', props: { type: "number", value: this.aggregatedSegmentNumberOfRides, min: 0 }},
        { label: 'Maximum Color', props: { type: "number", value: this.aggregatedSegmentColorMax }},
        { label: 'Maximum Width', props: { type: "number", value: this.aggregatedSegmentWidthMax }},
        { label: 'Property', props: { type: "select", value: this.aggregatedSegmentProperty, options: BASE_METRIC_SELECTABLE_PROPERTIES }},
      ]
    },
    {
      group: 'Region', items: [
        { label: 'Minimum Number of Rides', props: { type: "number", value: this.regionNumberOfRides, min: 0 }},
        { label: 'Maximum Color', props: { type: "number", value: this.regionColorMax }},
        { label: 'Maximum Width', props: { type: "number", value: this.regionWidthMax }},
        { label: 'Property', props: { type: "select", value: this.regionProperty, options: REGION_SELECTABLE_PROPERTIES }},
      ]
    },
    {
      group: 'Ride Segments', items: [
        { label: 'Maximum Color', props: { type: "number", value: this.rideSegmentColorMax }},
        { label: 'Property', props: { type: "select", value: this.rideSegmentProperty, options: BASE_SELECTABLE_PROPERTIES }},
      ]
    },
    {
      group: 'Time', items: [
        { label: 'Traffic Time', props: { type: "select", value: this.selectedTrafficTime, options: recordToOptions(this.getTimeCategoryOptions("trafficTime")) }},
        { label: 'Week Day', props: { type: "select", value: this.selectedWeekDay, options: recordToOptions(this.getTimeCategoryOptions("weekDay")) }},
        { label: 'Year', props: { type: "select", value: this.selectedYear, options: recordToOptions(this.getTimeCategoryOptions("year")) }},
      ]
    }
  ]);

  constructor(@Inject(APP_CONFIG) private config: AppEnvironmentInterface, private translate: TranslateService) {
    effect(() => {
      const map = this.map();
			if (!map) return;
      map.on('dblclick', e => {
        removeQueryParamsForLineHighlight(this._router);
        this.rideAdded().forEach(l => removeLineHighlight(map, l));
        const edgeMetricsAdded = this.edgeMetricsAdded;
        if (edgeMetricsAdded) removeLineHighlight(map, edgeMetricsAdded);
        const nodeMetricsAdded = this.nodeMetricsAdded;
        if (nodeMetricsAdded) removeLineHighlight(map, nodeMetricsAdded);
      });

      this.currentZoom.set(map.getZoom());
      map.on('zoom', () => {
        this.currentZoom.set(map.getZoom());
      })
		})

    effect(() => {
			const params = this.queryParams();
			const map = this.map();
			if (!map || !params) return;

      const sourceId: string = params["sourceId"];
      const queryId: number = Number(params["id"]);
      if (!sourceId || !queryId) return;

      this.queryId.set(queryId);
      this.querySourceId.set(sourceId);
		})

    effect(() => {
      const map = this.map();
      const sourceId = this.querySourceId();
      const queryId = this.queryId();
      if (!sourceId || !queryId || !map) return;
      const edgeMetricsAdded = this.edgeMetricsAdded;
      if (edgeMetricsAdded) highlightLine(map, edgeMetricsAdded, sourceId, queryId);
      const nodeMetricsAdded = this.nodeMetricsAdded;
      if (nodeMetricsAdded) highlightLine(map, nodeMetricsAdded, sourceId, queryId);
		})

    effect(() => {
      const map = this.map();
      const sourceId = this.querySourceId();
      const queryId = this.queryId();
      const rideAdded = this.rideAdded();
      if (!sourceId || !queryId || !map || !rideAdded) return;

      rideAdded.forEach(l => highlightLine(map, l, sourceId, queryId));
		})

    effect(() => {
      const sourceId = this.querySourceId();
      if (this.selectedRideId() !== null || !sourceId) return;
      // Select ride by query if it is not already selected

      const parts = sourceId.split("-");
      if (parts.length !== 2 || parts[1].length === 0) return;

      const id = Number(parts[1]);
      if (isNaN(id)) return;

      this.flyToRide = false;
      this.selectedRideId.set(id);
    });

    effect(() => {
      const selected = this.selectedRideId();
      const flyToRide = this.flyToRide;
      untracked(() => {
        this.onRideSelection(selected, flyToRide);
      })
      this.flyToRide = true;
    });

    effect(() => {
      const show = this.showTrafficSignals();
      this.trafficSignalsAdded.forEach(t => this.changeVisibilityAdded(t, show));
    });

    effect(() => {
      const show = this.showIntersectionMetrics();
      const edgeMetricsAdded = this.edgeMetricsAdded;
      if (edgeMetricsAdded) this.changeVisibilityAdded(edgeMetricsAdded, show);
      const nodeMetricsAdded = this.nodeMetricsAdded;
      if (nodeMetricsAdded) this.changeVisibilityAdded(nodeMetricsAdded, show);
    });

    effect(() => {
      const map = this.map();
      const request = this.metricSegmentRequestFilter();
			if (!map) return;
      this.applyIntersectionData(map, request);
    });

    effect(() => {
      const colorMax = this.aggregatedSegmentColorMax();
      const widthMax = this.aggregatedSegmentWidthMax();
      const property = this.aggregatedSegmentProperty();
      untracked(() => {
        const map = this.map();
        if (!map) return;
        this.applyAggregateStyle(map, property, colorMax, widthMax);
      })
    });

    effect(() => {
      const map = this.map();
      const request = this.regionRequestFilter();
			if (!map) return;
      this.applyRegionData(map, request);
    });

    effect(() => {
			const c = this.regionColorMax();
			const p = this.regionProperty();
			const w = this.regionWidthMax();
      untracked(() => {
        const map = this.map();
        if (!map) return;
		    this.applyRegionStyle(map, p, c, w);
      })
		})

    effect(() => {
      const c = this.rideSegmentColorMax();
      const p = this.rideSegmentProperty();
      
      untracked(() => {
        const map = this.map();
        if (!map) return;
		    this.applyRideStyle(map, p, c);
      })
    })
  }

  onMapReady(mlMap: maplibregl.Map) {
    const signals = displayTrafficSignalClustersVectorTiles(mlMap, this.config.apiUrl);
    const clusters = displayTrafficSignalsVectorTiles(mlMap, this.config.apiUrl);
    this.trafficSignalsAdded = [signals, clusters];
    this.map.set(mlMap);
	}

  changeVisibility(layerName: string, visible: boolean) {
    const map = this.map();
    if (!map || !map.getLayer(layerName)) return;
    map.setLayoutProperty(layerName, 'visibility', visible ? 'visible': 'none');
  }

  changeVisibilityAdded(added: addedOnMap, visible: boolean) {
    added.layerIds.forEach((id) => this.changeVisibility(id, visible));
    added.highlightLayerIds.forEach((id) => this.changeVisibility(id, visible));
  }

  applyIntersectionData(map: maplibregl.Map, request: MetricRequest) {
    const edgeMetricsAdded = this.edgeMetricsAdded;
    if (edgeMetricsAdded) deleteDisplay(map, edgeMetricsAdded);
    // The name  "edge-metrics" must match the layer spacified in the backend or else nothing is visible !
    this.edgeMetricsAdded = displayAggregateSegmentVectorTiles(this._router, map, this.config.apiUrl, "edge-metrics", request, false);

    const nodeMetricsAdded = this.nodeMetricsAdded;
    if (nodeMetricsAdded) deleteDisplay(map, nodeMetricsAdded);
    this.nodeMetricsAdded = displayAggregateSegmentVectorTiles(this._router, map, this.config.apiUrl, "node-metrics", request, true);
  }
  applyAggregateStyle(map: maplibregl.Map, colorProperty: keyof BaseMetric, colorMax: number, widthMax: number) {
    const edgeMetricsAdded = this.edgeMetricsAdded;
    if (edgeMetricsAdded) styleAggregateSegment(map, edgeMetricsAdded, this._router, colorProperty, colorMax, widthMax, false, this.config.apiUrl);

    const nodeMetricsAdded = this.nodeMetricsAdded;
    if (nodeMetricsAdded) styleAggregateSegment(map, nodeMetricsAdded, this._router, colorProperty, colorMax, widthMax, true, this.config.apiUrl);
  }

  private readonly regionZoom = {
    bigMin: 0,
    bigMax: 9,
    middleMin: 8,
    middleMax: 10,
    smallMin: 9,
    smallMax: 11,
  }
  async applyRegionData(map: maplibregl.Map, request: MetricRequest) {
    const bigRegions = this._requestService.getIntersectionRegionMetricsComplete({...request, adminLevel: 4});
    const middleRegions = this._requestService.getIntersectionRegionMetricsComplete({...request, adminLevel: 6});
    const smallRegions = this._requestService.getIntersectionRegionMetricsComplete({...request, adminLevel: 9});
    const regionsAdded = this.regionsAdded;
    regionsAdded.forEach(r => deleteDisplay(map, r));
    const bigAdded = displayRegions(await bigRegions, map, "regionBig", this.regionZoom.bigMin, this.regionZoom.bigMax);
    const middleAdded = displayRegions(await middleRegions, map, "regionMedium", this.regionZoom.middleMin, this.regionZoom.middleMax);
    const smallAdded = displayRegions(await smallRegions, map, "regionSmall", this.regionZoom.smallMin, this.regionZoom.smallMax);
    this.regionsAdded = [bigAdded, middleAdded, smallAdded];
  }
  applyRegionStyle(map: maplibregl.Map, colorProperty: keyof RegionMetric, colorMax: number, widthMax: number) {
    if (this.regionsAdded.length !== 3) return;
    styleRegions(map, this.regionsAdded[0], colorProperty, colorMax, widthMax, this.regionZoom.bigMin, this.regionZoom.bigMax);
    styleRegions(map, this.regionsAdded[1], colorProperty, colorMax, widthMax, this.regionZoom.middleMin, this.regionZoom.middleMax);
    styleRegions(map, this.regionsAdded[2], colorProperty, colorMax, widthMax, this.regionZoom.smallMin, this.regionZoom.smallMax);
  }

  async onRideSelection(selectedRideId: number | null, flyToRide: boolean) {
    const map = this.map();
    if (!map) return;
    
    this.rideAdded().forEach(l => deleteDisplay(map, l));

    if (!selectedRideId) {
      removeQueryParamsForLineHighlight(this._router);
      return;
    }
    
    const edges = await this._requestService.getIntersectionEdge(selectedRideId);
    if (edges.features.length === 0) return;
    if (flyToRide) {
      const coordiante = edges.features[0].geometry.coordinates[0];
      map.flyTo({ center: [coordiante[0], coordiante[1]], zoom: 18 });
    }
    const addedNodes = displayRideSegment(this._router, await this._requestService.getIntersectionNode(selectedRideId),
      map, `rideNodes-${selectedRideId}`, true);
    const addedEdges = displayRideSegment(this._router, edges, map, `rideEdges-${selectedRideId}`, true);
    const addedMatchedPoints = displayRidePoints(map, await this._requestService.getRidePoints(selectedRideId), `ridePoints-${selectedRideId}`);
    const addedRidePoints = displayMatchedPoints(map, await this._requestService.getMatchedPoints(selectedRideId), `matchedPoints-${selectedRideId}`);
    
    this.rideAdded.set([addedNodes, addedEdges, addedMatchedPoints, addedRidePoints]);
  }
  applyRideStyle(map: maplibregl.Map, colorProperty: keyof Base, colorMax: number) {
    const rideAdded = this.rideAdded();
    if (rideAdded.length !== 4) return;
    styleRideSegment(map, rideAdded[0], this._router, colorProperty, colorMax, true);
    styleRideSegment(map, rideAdded[1], this._router, colorProperty, colorMax, true);
  }
}