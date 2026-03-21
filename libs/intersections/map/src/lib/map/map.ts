import {
	Component,
	computed,
	effect,
	inject,
  Inject,
	signal,
  untracked
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
  addedOnMapDefault,
  colorToStops,
  COLORS,
	displayTrafficSignalsVectorTiles,
	displayTrafficSignalClustersVectorTiles,
	displayIntersection,
  displayIntersectionAggregateVectorTiles,
  displayMatchedPoints,
  displayRidePoints,
  displayRegions,
  getVisibleLegendItems,
	highlightLine,
  LegendItem,
  MapLegend,
  MapSettings,
  mergeAdded,
  removeLineHighlight,
  removeQueryParamsForLineHighlight,
  waitForSource,
  deleteDisplay,
  MetricRequest,
  ZOOM_LEVELS
} from '@simra/intersections-common';
import { APP_CONFIG, AppEnvironmentInterface, ETrafficTimes, EWeekDays, EYear } from '@simra/common-models';

@Component({
	selector: 'lib-map',
	imports: [CommonModule, MapPage, FormsModule, CheckboxModule, SelectModule, MapSettings, MapLegend],
	templateUrl: './map.html',
})
export class IntersectionsMap {
  private readonly _requestService = inject(IntersectionsRequestService);
  private readonly _router = inject(Router);
  private readonly _activatedRoute = inject(ActivatedRoute);
	private readonly queryParams = toSignal(this._activatedRoute.queryParams);
  private readonly queryId = signal<number | undefined>(undefined);
  private readonly querySourceId = signal<string | undefined>(undefined);

  private map: maplibregl.Map | undefined;
  private readonly mapDataLoaded = signal(false);
  private flyToRide = true;

  private rideAdded = signal<addedOnMap | null>(null);
  private edgeMetricsAdded: addedOnMap = addedOnMapDefault();
  private nodeMetricsAdded: addedOnMap = addedOnMapDefault();
  private regionsAdded: addedOnMap = addedOnMapDefault();
  private trafficSignalsAdded: addedOnMap = addedOnMapDefault();

  protected selectedRideId = signal<number | null>(null);
  protected showIntersectionMetrics = signal<boolean>(true);
  protected showTrafficSignals = signal<boolean>(true);
  protected selectedTrafficTime = signal<ETrafficTimes>(ETrafficTimes.ALL_DAY);
  protected selectedWeekDay = signal<EWeekDays>(EWeekDays.ALL_WEEK);
  protected selectedYear = signal<EYear>(EYear.ALL);

  protected readonly requestFilter = computed<MetricRequest>(() => {
    const trafficTime = this.selectedTrafficTime();
    const weekDay = this.selectedWeekDay();
    const year = this.selectedYear();
    return {
      numberOfRides: 0,
      trafficTime: trafficTime,
      weekDay: weekDay,
      year: year
    }
  })

  protected currentZoom = signal<number>(0);
  protected legendItems = computed<LegendItem[]>(() => {
    const zoom = this.currentZoom();
    const trafficSignalVisible: boolean = this.showTrafficSignals();
    const metricsVisible: boolean = this.showIntersectionMetrics();
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
        label: 'Segment Median Wait Time [s] ∈ [0, 120]',
        geometry: 'line',
        colorStops: colorToStops(COLORS.waitingTime),
        showIf: metricsVisible && zoom >= ZOOM_LEVELS.lines.minzoom
      },
      {
        label: 'Segment Number of Rides [#] ∈ [1, 50]',
        geometry: 'line',
        widthStops: [{ value: 0, width: 1 }, { value: 25, width: 4 }, { value: 50, width: 8 }],
        color: '#000000',
        showIf: metricsVisible && zoom >= ZOOM_LEVELS.lines.minzoom
      },
      {
        label: 'Region Intersection Wait Time [s/km] ∈ [0, 30]',
        geometry: 'polygon',
        colorStops: colorToStops(COLORS.regions),
        showIf: zoom < ZOOM_LEVELS.regions.maxzoom
      },
      {
        label: 'Region Number of Rides [#] ∈ [1, 500]',
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
        label: `Ride ${selectedRideId}, Segment Wait Time [s] ∈ [0, 120]`,
        geometry: 'line',
        colorStops: colorToStops(COLORS.waitingTime),
        showIf: selectedRideId != null && zoom >= ZOOM_LEVELS.lines.minzoom
      }
    ]);
  });

  constructor(@Inject(APP_CONFIG) private config: AppEnvironmentInterface) {
    effect(() => {
			const dataLoaded = this.mapDataLoaded();
      const map = this.map;
			if (!map || !dataLoaded) return;
      map.on('dblclick', e => {
        removeQueryParamsForLineHighlight(this._router);
        const rideAdded = this.rideAdded();
        if (rideAdded) removeLineHighlight(map, rideAdded);
        removeLineHighlight(map, this.edgeMetricsAdded);
        removeLineHighlight(map, this.nodeMetricsAdded);
      });

      this.currentZoom.set(map.getZoom());
      map.on('zoom', () => {
        this.currentZoom.set(map.getZoom());
      })
		})

    effect(() => {
			const params = this.queryParams();
			const dataLoaded = this.mapDataLoaded();
			if (!this.map || !dataLoaded || !params) return;

      const sourceId: string = params["sourceId"];
      const queryId: number = Number(params["id"]);
      if (!sourceId || !queryId) return;

      this.queryId.set(queryId);
      this.querySourceId.set(sourceId);
		})

    effect(() => {
      const sourceId = this.querySourceId();
      const queryId = this.queryId();
      if (!sourceId || !queryId || !this.map) return;

      highlightLine(this.map, this.edgeMetricsAdded, sourceId, queryId);
      highlightLine(this.map, this.nodeMetricsAdded, sourceId, queryId);
		})

    effect(() => {
      const sourceId = this.querySourceId();
      const queryId = this.queryId();
      const rideAdded = this.rideAdded();
      if (!sourceId || !queryId || !this.map || !rideAdded) return;

      highlightLine(this.map, rideAdded, sourceId, queryId);
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
      this.changeVisibilityAdded(this.trafficSignalsAdded, show);
    });

    effect(() => {
      const show = this.showIntersectionMetrics();
      this.changeVisibilityAdded(this.edgeMetricsAdded, show);
      this.changeVisibilityAdded(this.nodeMetricsAdded, show);
    });

    effect(() => {
			if (!this.map) return;
      this.applyIntersectionData(this.map, this.requestFilter());
    });

    effect(() => {
			if (!this.map) return;
      this.applyRegionData(this.map, this.requestFilter());
    });
  }

  onMapReady(mlMap: maplibregl.Map) {
    this.map = mlMap;
    
    this.trafficSignalsAdded = displayTrafficSignalClustersVectorTiles(mlMap, this.config.apiUrl);
    mergeAdded(this.trafficSignalsAdded, displayTrafficSignalsVectorTiles(mlMap, this.config.apiUrl));

    this.applyIntersectionData(mlMap, this.requestFilter());
    this.applyRegionData(mlMap, this.requestFilter());

    this.mapDataLoaded.set(true);
	}

  changeVisibility(layerName: string, visible: boolean) {
    if (!this.map || !this.map.getLayer(layerName)) return;
    this.map.setLayoutProperty(layerName, 'visibility', visible ? 'visible': 'none');
  }

  changeVisibilityAdded(added: addedOnMap, visible: boolean) {
    added.layerIds.forEach((id) => this.changeVisibility(id, visible));
    added.highlightLayerIds.forEach((id) => this.changeVisibility(id, visible));
  }

  applyIntersectionData(map: maplibregl.Map, request: MetricRequest) {
    deleteDisplay(map, this.edgeMetricsAdded );
    this.edgeMetricsAdded = displayIntersectionAggregateVectorTiles(this._router, map, this.config.apiUrl, "edge-metrics", request, false);

    deleteDisplay(map, this.nodeMetricsAdded);
    this.nodeMetricsAdded = displayIntersectionAggregateVectorTiles(this._router, map, this.config.apiUrl, "node-metrics", request);
  }

  async applyRegionData(map: maplibregl.Map, request: MetricRequest) {
    const regions = await this._requestService.getIntersectionRegionMetricsComplete(request);
    deleteDisplay(map, this.regionsAdded);
    mergeAdded(this.regionsAdded, displayRegions(regions, map, "regionBig", 0, 8, ['==', ['get', 'adminLevel'], 4]));
    mergeAdded(this.regionsAdded, displayRegions(regions, map, "regionMedium", 8, 11, ['==', ['get', 'adminLevel'], 6]));
    mergeAdded(this.regionsAdded, displayRegions(regions, map, "regionSmall", 8, 11, ['==', ['get', 'adminLevel'], 9]));
  }

  async onRideSelection(selectedRideId: number | null, flyToRide: boolean) {
    if (!this.map) return;

    const rideAdded = this.rideAdded();
    if (rideAdded) deleteDisplay(this.map, rideAdded);

    if (!selectedRideId) {
      removeQueryParamsForLineHighlight(this._router);
      return;
    }
    
    const newAddedOnRide = addedOnMapDefault();
    mergeAdded(newAddedOnRide, displayIntersection(this._router, await this._requestService.getIntersectionNode(selectedRideId),
      this.map, `intersectionNodes-${selectedRideId}`, true));

    const edges = await this._requestService.getIntersectionEdge(selectedRideId);
    if (edges.features.length === 0) return;
    if (flyToRide) {
      const coordiante = edges.features[0].geometry.coordinates[0];
      this.map.flyTo({ center: [coordiante[0], coordiante[1]], zoom: 18 });
    }
    
    mergeAdded(newAddedOnRide, displayIntersection(this._router, edges, this.map, `intersectionEdges-${selectedRideId}`, true, false));
    mergeAdded(newAddedOnRide, displayRidePoints(this.map, await this._requestService.getRidePoints(selectedRideId), `ridePoints-${selectedRideId}`));
    mergeAdded(newAddedOnRide, displayMatchedPoints(this.map, await this._requestService.getMatchedPoints(selectedRideId), `matchedPoints-${selectedRideId}`));
    this.rideAdded.set(newAddedOnRide);
  }
}