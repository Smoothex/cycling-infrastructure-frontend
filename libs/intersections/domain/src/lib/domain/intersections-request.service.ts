import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { defaults, isEmpty, isNumber, omitBy, pickBy } from 'lodash';
import { FeatureCollection, Point, LineString, Polygon } from 'geojson';
import { 
  IntersectionNodeAggregateRequest, 
  IntersectionEdgeAggregateRequest,
  RegionAggregateRequest,
  PagedGeoResponse
} from '@simra/intersections-common';

@Injectable({
  providedIn: 'root'
})
export class IntersectionsRequestService {
  private readonly _http = inject(HttpClient);

  
  public getIds(): Observable<number[]> {
    return this._http.get<number[]>('/api/intersections/ids');
  }

  public getRidePoints(id: number): Observable<FeatureCollection<Point>> {
    return this._http.get<FeatureCollection<Point>>(`/api/intersections/${id}/points`);
  }

  public getMatchedPoints(id: number): Observable<FeatureCollection<Point>> {
    return this._http.get<FeatureCollection<Point>>(`/api/intersections/${id}/matched_points`);
  }

  public getIntersectionEdge(id: number): Observable<FeatureCollection<LineString>> {
    return this._http.get<FeatureCollection<LineString>>(`/api/intersections/${id}/intersection_edges`);
  }

  public getIntersectionNode(id: number): Observable<FeatureCollection<LineString>> {
    return this._http.get<FeatureCollection<LineString>>(`/api/intersections/${id}/intersection_nodes`);
  }

  public getIntersectionNodeFiltered(trafficSignalClusterId: number, startOsmId: number | null, endOsmId: number | null): Observable<FeatureCollection<LineString>> {
    const startString = startOsmId != null ? `&startOsmId=${startOsmId}` : "";
    const endString = endOsmId != null ? `&endOsmId=${endOsmId}` : "";
    return this._http.get<FeatureCollection<LineString>>(`/api/intersections/intersection_nodes?trafficSignalClusterId=${trafficSignalClusterId}${startString}${endString}`);
  }
 
  public getIntersectionNodeAggregateWithFilter(request: IntersectionNodeAggregateRequest): Observable<PagedGeoResponse<LineString>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
		return this._http.get<PagedGeoResponse<LineString>>('/api/intersections/intersection_nodes/aggregate', { params });
  }

  public getIntersectionNodeStreetNames(request: IntersectionNodeAggregateRequest): Observable<string[]> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
		return this._http.get<string[]>('/api/intersections/intersection_nodes/streetNames', { params });
	}

  public getIntersectionEdgeFiltered(prevOsmId: number | null, osmId: number | null, nextOsmId: number | null): Observable<FeatureCollection<LineString>> {
    const pString = prevOsmId != null ? `&prevOsmId=${prevOsmId}` : "";
    const oString = osmId != null ? `&osmId=${osmId}` : "";
    const nString = nextOsmId != null ? `&nextOsmId=${nextOsmId}` : "";
    return this._http.get<FeatureCollection<LineString>>(`/api/intersections/intersection_edges?filter=true&${pString}${oString}${nString}`);
  }

  public getIntersectionEdgeAggregateWithFilter(request: IntersectionEdgeAggregateRequest): Observable<PagedGeoResponse<LineString>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    return this._http.get<PagedGeoResponse<LineString>>('/api/intersections/intersection_edges/aggregate', { params });
  }

  public getIntersectionEdgeStreetNames(request: IntersectionEdgeAggregateRequest): Observable<string[]> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
		return this._http.get<string[]>('/api/intersections/intersection_edges/streetNames', { params });
  }

  public getRideIdsByOsmId(osmId: number): Observable<number[]> {
    return this._http.get<number[]>(`/api/intersections/rideIds/${osmId}`);
  }

  public getTrafficSignals(): Observable<FeatureCollection<Point>> {
    return this._http.get<FeatureCollection<Point>>(`/api/osm/traffic-signals`);
  }

  public getTrafficSignalsByOsmId(osmId: number): Observable<FeatureCollection<Point>> {
    return this._http.get<FeatureCollection<Point>>(`/api/osm/traffic-signals/${osmId}`);
  }

  public getTrafficSignalsByTrafficSignalClusterId(trafficSignalClusterId: number): Observable<FeatureCollection<Point>> {
    return this._http.get<FeatureCollection<Point>>(`/api/osm/traffic-signals/cluster/${trafficSignalClusterId}`);
  }

  public getTrafficSignalPolygons(): Observable<FeatureCollection<Polygon>> {
    return this._http.get<FeatureCollection<Polygon>>(`/api/osm/cluster-polygons`);
  }

  public getTrafficSignalPolygonsByTrafficSignalClusterId(trafficSignalClusterId: number): Observable<FeatureCollection<Polygon>> {
    return this._http.get<FeatureCollection<Polygon>>(`/api/osm/cluster-polygons/${trafficSignalClusterId}`);
  }

  public getRegionAggregate(request: null | RegionAggregateRequest = null): Observable<FeatureCollection<Polygon>> {
    let filter = "";
    if (request) {
      const rString = request.region != undefined ? `&region=${request.region}` : "";
      filter = `?filter=true${rString}`;
    }
    return this._http.get<FeatureCollection<Polygon>>(`/api/intersections/regions/aggregate${filter}`);
  }

  public getRegionByName(name: null | string = null): Observable<FeatureCollection<Polygon>> {
    let filter = "";
    if (name) {
      const rString = `&region=${name}`;
      filter = `?filter=true${rString}`;
    }
    return this._http.get<FeatureCollection<Polygon>>(`/api/intersections/regions/polygon${filter}`);
  }
}

