import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { defaults, isEmpty, isNumber, omitBy, pickBy } from 'lodash';
import { FeatureCollection, Point, LineString, Polygon } from 'geojson';
import { 
  NodePageableMetricRequest, 
  EdgePageableMetricRequest,
  RegionMetricRequest,
  MetricRequest,
  PagedGeoResponse,
  BaseRequest
} from '@simra/intersections-common';
import { 
  processTrafficSignalCluster,
  processMatchedPoints,
  processRidePoints,
  processIntersectionBase,
  processIntersectionMetrics,
  processRegion
} from './request-helper'

@Injectable({
  providedIn: 'root'
})
export class IntersectionsRequestService {
  private readonly _http = inject(HttpClient);

  
  public getIds(): Promise<number[]> {
    return firstValueFrom(this._http.get<number[]>('/api/intersections/ids'));
  }

  public async getRidePoints(id: number): Promise<FeatureCollection<Point>> {
    const data = await firstValueFrom(this._http.get<FeatureCollection<Point>>(`/api/intersections/${id}/points`));
    processRidePoints(data);
    return data;
  }

  public async getMatchedPoints(id: number): Promise<FeatureCollection<Point>> {
    const data = await firstValueFrom(this._http.get<FeatureCollection<Point>>(`/api/intersections/${id}/matched_points`));
    processMatchedPoints(data);
    return data;
  }

  public async getIntersectionEdge(id: number): Promise<FeatureCollection<LineString>> {
    const data = await firstValueFrom(this._http.get<FeatureCollection<LineString>>(`/api/intersections/${id}/intersection_edges`));
    processIntersectionBase(data);
    return data;
  }

  public async getIntersectionNode(id: number): Promise<FeatureCollection<LineString>> {
    const data = await firstValueFrom(this._http.get<FeatureCollection<LineString>>(`/api/intersections/${id}/intersection_nodes`));
    processIntersectionBase(data);
    return data;
  }

  public async getIntersectionNodeMetricsComplete(request: MetricRequest): Promise<FeatureCollection<LineString>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    const data = await firstValueFrom(this._http.get<FeatureCollection<LineString>>('/api/intersections/intersection_nodes/aggregate/complete', { params }));
    processIntersectionMetrics(data);
    return data;
  }
 
  public getIntersectionNodeMetricsPageable(request: NodePageableMetricRequest): Promise<PagedGeoResponse<LineString>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
		return firstValueFrom(this._http.get<PagedGeoResponse<LineString>>('/api/intersections/intersection_nodes/aggregate', { params }));
  }

  public getIntersectionNodeStreetNames(request: NodePageableMetricRequest): Observable<string[]> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
		return this._http.get<string[]>('/api/intersections/intersection_nodes/streetNames', { params });
	}

  public async getIntersectionEdgeMetricsComplete(request: MetricRequest): Promise<FeatureCollection<LineString>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    const data = await firstValueFrom(this._http.get<FeatureCollection<LineString>>('/api/intersections/intersection_edges/aggregate/complete', { params }));
    processIntersectionMetrics(data);
    return data;
  }

  public getIntersectionEdgeMetricsPageable(request: EdgePageableMetricRequest): Promise<PagedGeoResponse<LineString>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    return firstValueFrom(this._http.get<PagedGeoResponse<LineString>>('/api/intersections/intersection_edges/aggregate', { params }));
  }

  public getIntersectionEdgeStreetNames(request: EdgePageableMetricRequest): Observable<string[]> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
		return this._http.get<string[]>('/api/intersections/intersection_edges/streetNames', { params });
  }

  public async getIntersectionBase(request: BaseRequest): Promise<FeatureCollection<LineString>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    const data = await firstValueFrom(this._http.get<FeatureCollection<LineString>>('/api/intersections/intersection_base', { params }));
    processIntersectionBase(data);
    return data;
  }

  public async getMatchedPointsIntersectionBase(request: BaseRequest): Promise<FeatureCollection<Point>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    const data = await firstValueFrom(this._http.get<FeatureCollection<Point>>('/api/intersections/intersection_base/matched_points', { params }));
    processMatchedPoints(data);
    return data;
  }
  
  public async getRidePointsIntersectionBase(request: BaseRequest): Promise<FeatureCollection<Point>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    const data = await firstValueFrom(this._http.get<FeatureCollection<Point>>('/api/intersections/intersection_base/ride_points', { params }));
    processRidePoints(data);
    return data;
  }

  public getTrafficSignals(): Promise<FeatureCollection<Point>> {
    return firstValueFrom(this._http.get<FeatureCollection<Point>>(`/api/osm/traffic-signals`));
  }

  public getTrafficSignalsByTrafficSignalClusterId(trafficSignalClusterId: number): Promise<FeatureCollection<Point>> {
    return firstValueFrom(this._http.get<FeatureCollection<Point>>(`/api/osm/traffic-signals/cluster/${trafficSignalClusterId}`));
  }

  public async getTrafficSignalClusters(): Promise<FeatureCollection<Polygon>> {
    const data = await firstValueFrom(this._http.get<FeatureCollection<Polygon>>(`/api/osm/cluster-polygons`));
    processTrafficSignalCluster(data);
    return data;
  }

  public async getTrafficSignalClustersByTrafficSignalClusterId(trafficSignalClusterId: number): Promise<FeatureCollection<Polygon>> {
    const data = await firstValueFrom(this._http.get<FeatureCollection<Polygon>>(`/api/osm/cluster-polygons/${trafficSignalClusterId}`));
    processTrafficSignalCluster(data);
    return data;
  }

  public async getIntersectionRegionMetricsComplete(request: MetricRequest): Promise<FeatureCollection<Polygon>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    const data = await firstValueFrom(this._http.get<FeatureCollection<Polygon>>('/api/intersections/regions/complete', { params }));
    processRegion(data);
    return data;
  }

  public getIntersectionRegionMetricsPageable(request: RegionMetricRequest): Promise<PagedGeoResponse<Polygon>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    return firstValueFrom(this._http.get<PagedGeoResponse<Polygon>>('/api/intersections/regions/pageable', { params }));
  }
}

