import {
	Component,
	computed,
	effect,
	inject,
  model,
	signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { MapPage } from '@simra/common-components';
import { IntersectionsRequestService } from '@simra/intersections-domain'
import { FeatureCollection, LineString, Point, Polygon } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import { SelectModule } from 'primeng/select';
import { CheckboxModule } from 'primeng/checkbox';
import {
  addedOnMap,
  addedOnMapDefault,
  COLORS,
	displayTrafficSignals,
	displayTrafficSignalClusters,
	displayIntersection,
  displayIntersectionAggregate,
  displayMatchedPoints,
  displayRidePoints,
  displayRegions,
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
import { ETrafficTimes, EWeekDays, EYear } from '@simra/common-models';

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

  private map: maplibregl.Map | undefined;
  private readonly mapDataLoaded = signal(false);

  private rideIds: number[] = [];
  private rideAdded: addedOnMap = addedOnMapDefault();
  private edgeMetrics: FeatureCollection<LineString> | undefined;
  private edgeMetricsAdded: addedOnMap = addedOnMapDefault();
  private nodeMetrics: FeatureCollection<LineString> | undefined;
  private nodeMetricsAdded: addedOnMap = addedOnMapDefault();
  private trafficSignals: FeatureCollection<Point> | undefined;
  private trafficSignalClusterPolygons: FeatureCollection<Polygon> | undefined;
  private regions: FeatureCollection<Polygon> | undefined;
  private regionsAdded: addedOnMap = addedOnMapDefault();

  protected selectableRideIds = signal<{ id: number; label: string }[]>([]);
  protected selectedRideId = signal<number | null>(null);
  protected showIntersectionMetrics = signal<boolean>(true);
  protected showTrafficSignals = signal<boolean>(true);
  protected selectedTrafficTime = signal<ETrafficTimes>(ETrafficTimes.ALL_DAY);
  protected selectedWeekDay = signal<EWeekDays>(EWeekDays.ALL_WEEK);
  protected selectedYear = signal<EYear>(EYear.ALL);

  protected currentZoom = signal<number>(0);
  protected legendItems = computed<LegendItem[]>(() => {
    const zoom = this.currentZoom();
    const items: LegendItem[] = [];

    if (this.showTrafficSignals()) {
      if (zoom >= ZOOM_LEVELS.points.minzoom) {
        items.push({
          label: 'Traffic Signal',
          geometry: 'point',
          color: COLORS.trafficSignals
        })
      }

      if (zoom >= ZOOM_LEVELS.polygons.minzoom) {
        items.push({
          label: 'Traffic Signal Intersection',
          geometry: 'polygon',
          color: COLORS.trafficSignalClusters
        })
      }
    }

    if (this.showIntersectionMetrics() && zoom >= ZOOM_LEVELS.lines.minzoom) {
      items.push({
        label: 'Segment Median Wait Time [s] ∈ ]0, 120[',
        geometry: 'line',
        colorStops: Object.entries(COLORS.waitingTime).map(([v, c]) => ({
          value: Number(v),
          color: c
        }))
      });

      items.push({
        label: 'Segment Number of Rides [#] ∈ [1, 50[',
        geometry: 'line',
        widthStops: [
          { value: 0, width: 1 },
          { value: 25, width: 4 },
          { value: 50, width: 8 }
        ],
        color: '#000000'
      });
    }

    if (zoom < ZOOM_LEVELS.regions.maxzoom) {
      items.push({
      label: 'Region Intersection Wait Time [s/km] ∈ ]0, 30[',
      geometry: 'polygon',
      colorStops: Object.entries(COLORS.regions).map(([v, c]) => ({
          value: Number(v),
          color: c
        }))
      });

      items.push({
        label: 'Region Number of Rides [#] ∈ [1, 500[',
        geometry: 'line',
        widthStops: [
          { value: 10, width: 1 },
          { value: 50, width: 4 },
          { value: 500, width: 8 }
        ],
        color: '#000000'
      });
    }

    const selectedRideId = this.selectedRideId();
    if (selectedRideId) {
      if (zoom >= ZOOM_LEVELS.points.minzoom) {
        items.push({
          label: `Ride ${selectedRideId}, GPS`,
          geometry: 'point',
          color: COLORS.ridePoints
        })

        items.push({
          label: `Ride ${selectedRideId}, Matched Points`,
          geometry: 'point',
          color: COLORS.matchedPoints
        })
      }

      if (zoom >= ZOOM_LEVELS.lines.minzoom) {
        items.push({
          label: `Ride ${selectedRideId}, Segment Wait Time [s] ∈ [0, 120]`,
          geometry: 'line',
          colorStops: Object.entries(COLORS.waitingTime).map(([v, c]) => ({
            value: Number(v),
            color: c
          }))
        })
      }
    }

    return items;
  });

  constructor() {
    effect(() => {
			const dataLoaded = this.mapDataLoaded();
      const map = this.map;
			if (!map || !dataLoaded) return;
      map.on('dblclick', e => {
        removeQueryParamsForLineHighlight(this._router);
        if (!this.map) return;
        removeLineHighlight(this.map, this.rideAdded);
        removeLineHighlight(this.map, this.edgeMetricsAdded);
        removeLineHighlight(this.map, this.nodeMetricsAdded);
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
      const selectedId: number = Number(params["id"]);
      if (!sourceId || !selectedId) return;

      // Highlight line specified by query parameters
      highlightLine(this.map, this.edgeMetricsAdded, sourceId, selectedId);
      highlightLine(this.map, this.nodeMetricsAdded, sourceId, selectedId);
      this.highlightRideByQueryParams(this.map, sourceId, selectedId);
		})

    effect(() => {
      const selected = this.selectedRideId();
      this.onRideSelection(selected);
    });

    effect(() => {
      const show = this.showTrafficSignals();
      this.changeVisibility("trafficSignals-layer", show);
      this.changeVisibility(`trafficSignalClustersPolygons-layer`, show);
    });

    effect(() => {
      const show = this.showIntersectionMetrics();
      this.changeVisibilityAdded(this.edgeMetricsAdded, show);
      this.changeVisibilityAdded(this.nodeMetricsAdded, show);
    });

    effect(() => {
      const trafficTime = this.selectedTrafficTime();
      const weekDay = this.selectedWeekDay();
      const year = this.selectedYear();
			if (!this.map) return;

      this.applyIntersectionData(this.map, {
        numberOfRides: 0,
        trafficTime: trafficTime,
        weekDay: weekDay,
        year: year
      })
    });
  }

  async highlightRideByQueryParams(map: maplibregl.Map, sourceId: string, selectedId: number) {
    const parts = sourceId.split("-");
    if (parts.length !== 2 || parts[1].length === 0) return;

    const id = Number(parts[1]);
    if (isNaN(id) || !this.rideIds.includes(id)) return;

    if (!this.selectedRideId()) {
      // load ride if it is not already selected
      this.selectedRideId.set(id);
      await waitForSource(map, sourceId);
    }
    if (!map.getSource(sourceId)) return;

    highlightLine(map, this.rideAdded, sourceId, selectedId);
  }

  async onMapReady(mlMap: maplibregl.Map) {
    try {
      this.map = mlMap;  

      this.trafficSignalClusterPolygons = await this._requestService.getTrafficSignalClusters();
      displayTrafficSignalClusters(mlMap, this.trafficSignalClusterPolygons, true);

      this.trafficSignals = await this._requestService.getTrafficSignals();
      displayTrafficSignals(mlMap, this.trafficSignals);

      await this.applyIntersectionData(mlMap, {
        numberOfRides: 0,
        trafficTime: this.selectedTrafficTime(),
        weekDay: this.selectedWeekDay(),
        year: this.selectedYear()
      })

      this.rideIds = await this._requestService.getIds();
      this.selectableRideIds.set(this.rideIds.map((id) => { return {id: id, label: `${id}` }}));  

      await waitForSource(mlMap, "intersectionEdgeAggregate");
      await waitForSource(mlMap, "intersectionNodeAggregate");
      this.mapDataLoaded.set(true);
      console.log("Loaded data.");  
    } catch (e) {
      console.error("Error during fetching rides: ", e)
    }
	}

  changeVisibility(layerName: string, visible: boolean) {
    if (!this.map || !this.map.getLayer(layerName)) return;
    this.map.setLayoutProperty(layerName, 'visibility', visible ? 'visible': 'none');
  }

  changeVisibilityAdded(added: addedOnMap, visible: boolean) {
    added.layerIds.forEach((id) => this.changeVisibility(id, visible));
  }

  async applyIntersectionData(map: maplibregl.Map, request: MetricRequest) {
    this.edgeMetrics = await this._requestService.getIntersectionEdgeMetricsComplete(request);
    deleteDisplay(map, this.edgeMetricsAdded );
    this.edgeMetricsAdded = displayIntersectionAggregate(this._router, this.edgeMetrics, map, "intersectionEdgeAggregate", true, false);

    this.nodeMetrics = await this._requestService.getIntersectionNodeMetricsComplete(request);
    deleteDisplay(map, this.nodeMetricsAdded);
    this.nodeMetricsAdded = displayIntersectionAggregate(this._router, this.nodeMetrics, map, "intersectionNodeAggregate", true);

    this.regions = await this._requestService.getIntersectionRegionMetricsComplete(request);
    deleteDisplay(map, this.regionsAdded);
    mergeAdded(this.regionsAdded, displayRegions(this.regions, map, "regionMedium", 8, 11, ['>=', ['get', 'adminLevel'], 6]));
    mergeAdded(this.regionsAdded, displayRegions(this.regions, map, "regionBig", 0, 8, ['==', ['get', 'adminLevel'], 4]));
  }

  async onRideSelection(selectedRideId: number | null) {
    if (!this.map) return;
    deleteDisplay(this.map, this.rideAdded);

    if (!selectedRideId) {
      removeQueryParamsForLineHighlight(this._router);
      return;
    }

    const ridePoints = await this._requestService.getRidePoints(selectedRideId);
    if (ridePoints.features.length === 0) return;
    const coordiante = ridePoints.features[0].geometry.coordinates;
    this.map.flyTo({ center: [coordiante[0], coordiante[1]] });
    
    mergeAdded(this.rideAdded, displayRidePoints(this.map, ridePoints, `ridePoints-${selectedRideId}`));
    mergeAdded(this.rideAdded, displayMatchedPoints(this.map, await this._requestService.getMatchedPoints(selectedRideId), `matchedPoints-${selectedRideId}`));
    mergeAdded(this.rideAdded, displayIntersection(this._router, await this._requestService.getIntersectionNode(selectedRideId),
      this.map, `intersectionNodes-${selectedRideId}`, true));
    mergeAdded(this.rideAdded, displayIntersection(this._router, await this._requestService.getIntersectionEdge(selectedRideId),
      this.map, `intersectionEdges-${selectedRideId}`, true, false));
  }
}