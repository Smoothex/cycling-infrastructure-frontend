import {
	ChangeDetectionStrategy,
	Component,
	effect,
	inject,
	model, signal,
	ViewEncapsulation,
  ChangeDetectorRef
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { EPin, MapPage, MapUtils } from '@simra/common-components';
import { IntersectionsMapFacade } from '@simra/intersections-domain'
import { Feature, FeatureCollection, GeoJsonProperties, LineString, Point, Polygon } from 'geojson';
import { distance } from '@turf/turf';
import * as maplibregl from 'maplibre-gl';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputGroupModule } from 'primeng/inputgroup';
import { Button } from 'primeng/button';
import { InputNumber } from 'primeng/inputnumber';
import { Dialog } from 'primeng/dialog';
import { CheckboxModule } from 'primeng/checkbox';
import {
  displayPoints,
	displayTrafficSignals,
	displayTrafficSignalPolygons,
	displayIntersection,
  displayIntersectionAggregate,
	highlightLineFromQueryParams,
  removeLineHighlight,
  displayPolygons,
  displayRegions,
  waitForSource
} from '@simra/intersections-common';
import { ETrafficTimes, EWeekDays, EYear } from '@simra/common-models';

@Component({
	selector: 'lib-map',
	imports: [CommonModule, MapPage, FormsModule, MultiSelectModule, InputGroupModule, Button, InputNumber, Dialog, CheckboxModule],
	templateUrl: './map.html',
})
export class IntersectionsMap {
  private readonly _intersectionsMapFacade = inject(IntersectionsMapFacade);
  private readonly _router = inject(Router);
  private readonly _activatedRoute = inject(ActivatedRoute);
	private readonly queryParams = toSignal(this._activatedRoute.queryParams);

  routes: { id: number; label: string }[] = [];
  selectedRouteIds: number[] = [];
  loadedRouteIds: number[] = [];
  map: maplibregl.Map | undefined;
  private readonly mapDataLoaded = signal(false);

  private rideIds: number[] = [];
  private ridePoints: FeatureCollection<Point>[] = [];
  private matchedRidePoints: FeatureCollection<Point>[] = [];
  private rideIntersectionEdges: FeatureCollection<LineString>[] = [];
  private rideIntersectionNodes: FeatureCollection<LineString>[] = [];
  private intersectionEdgeAggregate: FeatureCollection<LineString> | undefined;
  private intersectionNodeAggregate: FeatureCollection<LineString> | undefined;
  private trafficSignals: FeatureCollection<Point> | undefined;
  private trafficSignalClusterPolygons: FeatureCollection<Polygon> | undefined;
  private regions: FeatureCollection<Polygon> | undefined;

  osmIdInput!: number;
  rideIdsOsmID: number[] | undefined;
  trafficSignalIdsOsmID: number[] | undefined;
  showRideIdDialog = false;

  showRidePoints: boolean = true;
  showMatchedRidePoints: boolean = true;
  showRideEdges: boolean = true;
  showRideIntersectionNodes: boolean = true;
  showTrafficSignals: boolean = true;
  showIntersectionEdgeAggregate: boolean = true;
  showIntersectionNodeAggregate: boolean = true;
  flyToRide: boolean = true;

  private readonly defaults = {
		numberOfRides: 0,
		weekDay: [EWeekDays.ALL_WEEK],
		trafficTime: [ETrafficTimes.ALL_DAY],
		year: [EYear.ALL],
		page: 0,
		size: 10000
	}

  constructor(private cdr: ChangeDetectorRef) {
    effect(() => {
			const params = this.queryParams();
			const dataLoaded = this.mapDataLoaded();
			if (!this.map || !dataLoaded || !params) return;

      // Remove Old Highlight
      removeLineHighlight(this.map, "intersectionEdgeAggregate");
      removeLineHighlight(this.map, "intersectionNodeAggregate");

			// Highlight line specified by query parameters
			const highlightingSuccessfull = highlightLineFromQueryParams(params, this.map);

      // If not succesfull try loading a ride
      if (!highlightingSuccessfull) {
        this.loadRideByQueryParams(params, this.map);
      }
		})
  }

  async loadRideByQueryParams(params: Params, map: maplibregl.Map) {
    const sourceId: string = params["sourceId"];
    if (sourceId) {
      const parts = sourceId.split("-");
      const id:number = Number(parts[parts.length-1]);
      if (!isNaN(id) && this.rideIds.includes(id) && !this.selectedRouteIds.includes(id)) {
        this.selectedRouteIds.push(id);
        await this.onRouteSelectionChange(false);
        await waitForSource(map, sourceId);

        const highlightingSuccessfull = highlightLineFromQueryParams(params, map);
        if (!highlightingSuccessfull) {
          console.error(`Highlighting failed unexpectantly on the query params: ${JSON.stringify(params)}`);
        }
      }
    }
  }

  async loadRideIdsAndTrafficSignalsByOsmId () {
    await this.loadTrafficSignalsByOsmId();
    await this.loadRideIdsByOsmId();
    console.log("Finished");
    this.showRideIdDialog = true;
    this.cdr.detectChanges();
  }

  async loadRideIdsByOsmId() {
    if (!this.osmIdInput) {
      console.error("No osmId.")
      return;
    }
    this.rideIdsOsmID = await this._intersectionsMapFacade.getRideIdsByOsmId(this.osmIdInput);
  }

  async loadTrafficSignalsByOsmId() {
    if (!this.osmIdInput) {
      console.error("No osmId.")
      return;
    }
    const trafficSignals = await this._intersectionsMapFacade.getTrafficSignalsByOsmId(this.osmIdInput);
    const trafficSignalIds: number[] = [];
    for (const trafficSignal of trafficSignals.features) {
      if (trafficSignal.properties?.["id"]) {
        trafficSignalIds.push(trafficSignal.properties["id"]);
      }
    }
    this.trafficSignalIdsOsmID = trafficSignalIds;
  }

  private displayPointArrayWithRideId(rides: FeatureCollection<Point>[], map: maplibregl.Map, sourceId: string, color: string = '#ff0000ff') {
    for (const ride of rides) {
      if (ride.features.length === 0 || !ride.features[0].properties) {
        continue;
      }
      const sourceIdRide = `${sourceId}-${ride.features[0].properties["rideId"]}`;
      displayPoints(ride, map, {
          sourceId: sourceIdRide,
          width: 4,
          visible: true,
          color: color,
      });
    }
  }

  async onMapReady(mlMap: maplibregl.Map) {
    try {
      this.map = mlMap;  

      this.trafficSignalClusterPolygons = await this._intersectionsMapFacade.getTrafficSignalPolygons();
      displayTrafficSignalPolygons(mlMap, this.trafficSignalClusterPolygons, true);

      this.trafficSignals = await this._intersectionsMapFacade.getTrafficSignals();
      displayTrafficSignals(mlMap, this.trafficSignals, true);

      const pagedEdgeAggregate = await this._intersectionsMapFacade.getIntersectionEdgeAggregate({
        numberOfRides: this.defaults.numberOfRides,
        weekDay: this.defaults.weekDay,
        trafficTime: this.defaults.trafficTime,
        year: this.defaults.year,
        page: this.defaults.page,
        size: this.defaults.size
      });
      this.intersectionEdgeAggregate = pagedEdgeAggregate.geoData;
      displayIntersectionAggregate(this._router, this.intersectionEdgeAggregate, mlMap, "intersectionEdgeAggregate", true);
      this.changeVisibility("intersectionEdgeAggregate-circle-layer", false);
      if (pagedEdgeAggregate.metadata.totalElements > this.defaults.size) {
        console.warn(`Number of Elements (${pagedEdgeAggregate.metadata.totalElements}) greater than default (${this.defaults.size})`)
      }

      const pagedNodeAggregate = await this._intersectionsMapFacade.getIntersectionNodeAggregate({
        numberOfRides: this.defaults.numberOfRides,
        weekDay: this.defaults.weekDay,
        trafficTime: this.defaults.trafficTime,
        year: this.defaults.year,
        page: this.defaults.page,
        size: this.defaults.size
      });
      this.intersectionNodeAggregate = pagedNodeAggregate.geoData;
      displayIntersectionAggregate(this._router, this.intersectionNodeAggregate, mlMap, "intersectionNodeAggregate", true);
      if (pagedNodeAggregate.metadata.totalElements > this.defaults.size) {
        console.warn(`Number of Elements (${pagedNodeAggregate.metadata.totalElements}) greater than default (${this.defaults.size})`)
      }

      this.regions = await this._intersectionsMapFacade.getRegions();
      displayRegions(this.regions, this.map, "regionMedium", 8, 11, ['>=', ['get', 'admin_level'], 6]);
      displayRegions(this.regions, this.map, "regionSmall", undefined, 8, ['==', ['get', 'admin_level'], 4]);

      this.rideIds = await this._intersectionsMapFacade.getIds();
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
    if (this.map !== undefined) {
      if (this.map.getLayer(layerName)) {
        this.map.setLayoutProperty(layerName, 'visibility', visible ? 'visible': 'none');
      }
    }
  }

  onShowTrafficSignalsChange() {
    this.changeVisibility("trafficSignals-layer", this.showTrafficSignals);
    this.changeVisibility(`trafficSignalClustersPolygons-layer`, this.showTrafficSignals);
  }

  onShowIntersectionEdgeAggregateChange() {
    this.changeVisibility("intersectionEdgeAggregate-layer", this.showIntersectionEdgeAggregate);
  }

  onShowIntersectionNodeAggregate() {
    this.changeVisibility("intersectionNodeAggregate-circle-layer", this.showIntersectionNodeAggregate);
    this.changeVisibility("intersectionNodeAggregate-layer", this.showIntersectionNodeAggregate);
  }

  private displayLineStringArrayWithRideId(rides: FeatureCollection<LineString>[], map: maplibregl.Map, sourceId: string, displayCircle: boolean = false) {
    for (const ride of rides) {
      if (ride.features.length === 0 || !ride.features[0].properties) {
        continue;
      }
      const sourceIdRide = `${sourceId}-${ride.features[0].properties["rideId"]}`;
      displayIntersection(this._router, ride, map, sourceIdRide, true);
      this.changeVisibility(`${sourceIdRide}-circle-layer`, displayCircle);
    }
  }

  async onRouteSelectionChange(flyTo: boolean = true) {
    if (this.map !== undefined) {
      const toBeLoadedIds = [];
      for (const route of this.routes) {
        const visibile: boolean = this.selectedRouteIds.includes(route.id);
        if (visibile && !this.loadedRouteIds.includes(route.id)) {
          toBeLoadedIds.push(route.id);
          this.loadedRouteIds.push(route.id);
        }
      }

      if (toBeLoadedIds.length > 0) {
        const newRidePoints = await Promise.all(toBeLoadedIds.map((id) => this._intersectionsMapFacade.getRidePoints(id)));
        this.ridePoints = this.ridePoints.concat(newRidePoints);
        this.displayPointArrayWithRideId(newRidePoints, this.map, "ridePoints", '#007AFF');

        const newMatchedRidePoints = await Promise.all(toBeLoadedIds.map((id) => this._intersectionsMapFacade.getMatchedPoints(id)));
        this.matchedRidePoints = this.matchedRidePoints.concat(newMatchedRidePoints);
        this.displayPointArrayWithRideId(newMatchedRidePoints, this.map, "matchedPoints", '#ff0000ff');

        const newRideEdges = await Promise.all(toBeLoadedIds.map((id) => this._intersectionsMapFacade.getIntersectionEdge(id)));
        this.rideIntersectionEdges = this.rideIntersectionEdges.concat(newRideEdges);
        this.displayLineStringArrayWithRideId(newRideEdges, this.map, "intersectionEdges");

        const newRideIntersectionNodes = await Promise.all(toBeLoadedIds.map((id) => this._intersectionsMapFacade.getIntersectionNode(id)));
        this.rideIntersectionNodes = this.rideIntersectionNodes.concat(newRideIntersectionNodes);
        this.displayLineStringArrayWithRideId(newRideIntersectionNodes, this.map, "intersectionNodes", true);
      }
      
      for (const route of this.routes) {
        const visibile: boolean = this.selectedRouteIds.includes(route.id);
        this.changeVisibility(`matchedPoints-${route.id}-layer`, visibile && this.showMatchedRidePoints);
        this.changeVisibility(`ridePoints-${route.id}-layer`, visibile && this.showRidePoints);
        this.changeVisibility(`intersectionEdges-${route.id}-layer`, visibile && this.showRideEdges);
        this.changeVisibility(`intersectionNodes-${route.id}-layer`, visibile && this.showRideIntersectionNodes);
        this.changeVisibility(`intersectionNodes-${route.id}-circle-layer`, visibile && this.showRideIntersectionNodes);
        if (visibile && this.flyToRide) {
          const features = this.ridePoints.filter(f => f.features[0]?.properties?.["rideId"] === route.id);
          const coordiante = features[0].features[0].geometry.coordinates;
          if (flyTo) {
            this.map.flyTo({ center: [coordiante[0], coordiante[1]] });
          }
        }
      }
    }
  }
}