import {
	Component,
	effect,
	inject,
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
	displayTrafficSignals,
	displayTrafficSignalClusters,
	displayIntersection,
  displayIntersectionAggregate,
  displayMatchedPoints,
  displayRidePoints,
  displayRegions,
	highlightLine,
  removeLineHighlight,
  removeQueryParamsForLineHighlight,
  waitForSource,
  deleteDisplay
} from '@simra/intersections-common';
import { ETrafficTimes, EWeekDays, EYear } from '@simra/common-models';

@Component({
	selector: 'lib-map',
	imports: [CommonModule, MapPage, FormsModule, CheckboxModule, SelectModule],
	templateUrl: './map.html',
})
export class IntersectionsMap {
  private readonly _requestService = inject(IntersectionsRequestService);
  private readonly _router = inject(Router);
  private readonly _activatedRoute = inject(ActivatedRoute);
	private readonly queryParams = toSignal(this._activatedRoute.queryParams);

  routes: { id: number; label: string }[] = [];
  selectedRideId = signal<number | null>(null);
  map: maplibregl.Map | undefined;
  private readonly mapDataLoaded = signal(false);

  private rideIds: number[] = [];
  private rideAdded: addedOnMap = { sourceIds: [], layerIds: [], highlightLayerIds: [] };
  private edgeMetrics: FeatureCollection<LineString> | undefined;
  private edgeMetricsAdded: addedOnMap = { sourceIds: [], layerIds: [], highlightLayerIds: [] };
  private nodeMetrics: FeatureCollection<LineString> | undefined;
  private nodeMetricsAdded: addedOnMap = { sourceIds: [], layerIds: [], highlightLayerIds: [] };
  private trafficSignals: FeatureCollection<Point> | undefined;
  private trafficSignalClusterPolygons: FeatureCollection<Polygon> | undefined;
  private regions: FeatureCollection<Polygon> | undefined;

  osmIdInput!: number;
  rideIdsOsmID: number[] | undefined;
  trafficSignalIdsOsmID: number[] | undefined;
  showRideIdDialog = false;

  showRide: boolean = true;
  showIntersectionMetrics: boolean = true;
  showTrafficSignals: boolean = true;


  private readonly defaults = {
		numberOfRides: 0,
		weekDay: EWeekDays.ALL_WEEK,
		trafficTime: ETrafficTimes.ALL_DAY,
		year: EYear.ALL
	}

  constructor() {
    effect(() => {
			const dataLoaded = this.mapDataLoaded();
			if (!this.map || !dataLoaded) return;
      this.map.on('dblclick', e => {
        removeQueryParamsForLineHighlight(this._router);
        if (!this.map) return;
        removeLineHighlight(this.map, this.rideAdded);
        removeLineHighlight(this.map, this.edgeMetricsAdded);
        removeLineHighlight(this.map, this.nodeMetricsAdded);
      });
		})

    effect(() => {
			const params = this.queryParams();
			const dataLoaded = this.mapDataLoaded();
			if (!this.map || !dataLoaded || !params) return;

      const sourceId: string = params["sourceId"];
      const selectedId: number = Number(params["id"]);
      if (!sourceId) return;

      // Highlight line specified by query parameters
      highlightLine(this.map, this.edgeMetricsAdded, sourceId, selectedId);
      highlightLine(this.map, this.nodeMetricsAdded, sourceId, selectedId);
      this.highlightRideByQueryParams(this.map, sourceId, selectedId);
		})
  }

  async highlightRideByQueryParams(map: maplibregl.Map, sourceId: string, selectedId: number) {
    const parts = sourceId.split("-");
    if (parts.length !== 2 || parts[1].length === 0) return;

    const id = Number(parts[1]);
    if (isNaN(id) || !this.rideIds.includes(id)) return;

    if (!this.selectedRideId()) {
      // load ride if it is not already selected
      this.selectedRideId.set(id);
      await this.onRideSelection();
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

      this.edgeMetrics = await this._requestService.getIntersectionEdgeMetricsComplete({
        numberOfRides: this.defaults.numberOfRides,
        weekDay: this.defaults.weekDay,
        trafficTime: this.defaults.trafficTime,
        year: this.defaults.year
      });
      this.edgeMetricsAdded = displayIntersectionAggregate(this._router, this.edgeMetrics, mlMap, "intersectionEdgeAggregate", true, false);

      this.nodeMetrics = await this._requestService.getIntersectionNodeMetricsComplete({
        numberOfRides: this.defaults.numberOfRides,
        weekDay: this.defaults.weekDay,
        trafficTime: this.defaults.trafficTime,
        year: this.defaults.year
      });
      this.nodeMetricsAdded = displayIntersectionAggregate(this._router, this.nodeMetrics, mlMap, "intersectionNodeAggregate", true);

      this.regions = await this._requestService.getIntersectionRegionMetricsComplete({
        numberOfRides: this.defaults.numberOfRides,
        weekDay: this.defaults.weekDay,
        trafficTime: this.defaults.trafficTime,
        year: this.defaults.year
      });
      displayRegions(this.regions, this.map, "regionMedium", 8, 11, ['>=', ['get', 'adminLevel'], 6]);
      displayRegions(this.regions, this.map, "regionSmall", undefined, 8, ['==', ['get', 'adminLevel'], 4]);

      this.rideIds = await this._requestService.getIds();
      this.routes = this.rideIds.map((id) => { return {id: id, label: `${id}` }});  

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

  onShowTrafficSignalsChange() {
    this.changeVisibility("trafficSignals-layer", this.showTrafficSignals);
    this.changeVisibility(`trafficSignalClustersPolygons-layer`, this.showTrafficSignals);
  }

  onShowIntersectionMetrics() {
    this.changeVisibilityAdded(this.edgeMetricsAdded, this.showIntersectionMetrics);
    this.changeVisibilityAdded(this.nodeMetricsAdded, this.showIntersectionMetrics);
  }

  onShowRide() {
    this.changeVisibilityAdded(this.rideAdded, this.showRide);
  }

  addOnRide(added: addedOnMap) {
    added.layerIds.forEach((id) => this.rideAdded.layerIds.push(id));
    added.highlightLayerIds.forEach((id) => this.rideAdded.highlightLayerIds.push(id));
    added.sourceIds.forEach((id) => this.rideAdded.sourceIds.push(id));
  }

  async onRideSelection() {
    if (!this.map) return;
    deleteDisplay(this.map, this.rideAdded);

    const id = this.selectedRideId();
    if (!id) {
      removeQueryParamsForLineHighlight(this._router);
      return;
    }
    this.showRide = true;

    const ridePoints = await this._requestService.getRidePoints(id);
    if (ridePoints.features.length === 0) return;
    const coordiante = ridePoints.features[0].geometry.coordinates;
    this.map.flyTo({ center: [coordiante[0], coordiante[1]] });
    
    this.addOnRide(displayRidePoints(this.map, ridePoints, `ridePoints-${id}`));
    this.addOnRide(displayMatchedPoints(this.map, await this._requestService.getMatchedPoints(id), `matchedPoints-${id}`));
    this.addOnRide(displayIntersection(this._router, await this._requestService.getIntersectionNode(id),
      this.map, `intersectionNodes-${id}`, true));
    this.addOnRide(displayIntersection(this._router, await this._requestService.getIntersectionEdge(id),
      this.map, `intersectionEdges-${id}`, true, false));
  }
}