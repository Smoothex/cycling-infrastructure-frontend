import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { defaults, isEmpty, isNumber, omitBy, pickBy } from 'lodash';
import { FeatureCollection, Point, LineString, Polygon } from 'geojson';
import {
  PagedIds,
  PagedProperties,
  PageableMetricRequest,
  IdListRequest,
  NodePageableMetricRequest, 
  EdgePageableMetricRequest,
  RegionMetricRequest,
  MetricRequest,
  PagedGeoResponse,
  RawBase,
  Base,
  BaseRequest,
  cleanBase,
  RawRideRegionMetric,
  RideRegionMetric,
  cleanRideRegionMetric,
  NodePageableRequest,
  EdgePageableRequest
} from '@simra/intersections-common';
import {
  processTrafficSignals,
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

  
  public getIds(request: IdListRequest): Promise<PagedIds> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    return firstValueFrom(this._http.get<PagedIds>('/api/intersections/ids', { params}));
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

  public async getIntersectionNodes(request: EdgePageableRequest): Promise<PagedGeoResponse<LineString>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    params["properties"] = false;
		return firstValueFrom(this._http.get<PagedGeoResponse<LineString>>('/api/intersections/intersection_nodes', { params }));
  }

  public async getIntersectionNodeProperties(request: NodePageableRequest): Promise<PagedProperties<Base>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    params["properties"] = true;
		const data = await firstValueFrom(this._http.get<PagedProperties<RawBase>>('/api/intersections/intersection_nodes', { params }));
    const cleaned: PagedProperties<Base> = {
      metadata: data.metadata,
      properties: cleanBase(data.properties)
    }
    return cleaned;
  }
 
  public async getIntersectionNodeMetricsPageable(request: NodePageableMetricRequest): Promise<PagedGeoResponse<LineString>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
		const data = await firstValueFrom(this._http.get<PagedGeoResponse<LineString>>('/api/intersections/intersection_nodes/aggregate', { params }));
    processIntersectionMetrics(data.geoData);
    return data;
  }

  public getIntersectionNodeStreetNames(request: NodePageableMetricRequest): Observable<string[]> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
		return this._http.get<string[]>('/api/intersections/intersection_nodes/streetNames', { params });
	}

  public async getIntersectionEdges(request: EdgePageableRequest): Promise<PagedGeoResponse<LineString>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    params["properties"] = false;
		return firstValueFrom(this._http.get<PagedGeoResponse<LineString>>('/api/intersections/intersection_edges', { params }));
  }

  public async getIntersectionEdgeProperties(request: EdgePageableRequest): Promise<PagedProperties<Base>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
		params["properties"] = true;
    const data = await firstValueFrom(this._http.get<PagedProperties<RawBase>>('/api/intersections/intersection_edges', { params }));
    const cleaned: PagedProperties<Base> = {
      metadata: data.metadata,
      properties: cleanBase(data.properties)
    }
    return cleaned;
  }

  public async getIntersectionEdgeMetricsPageable(request: EdgePageableMetricRequest): Promise<PagedGeoResponse<LineString>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    const data = await firstValueFrom(this._http.get<PagedGeoResponse<LineString>>('/api/intersections/intersection_edges/aggregate', { params }));
    processIntersectionMetrics(data.geoData);
    return data;
  }

  public getIntersectionEdgeStreetNames(request: EdgePageableMetricRequest): Observable<string[]> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
		return this._http.get<string[]>('/api/intersections/intersection_edges/streetNames', { params });
  }

  public async getIntersectionBasePropertiesSingular(id: number): Promise<Base | null> {
    const data = await firstValueFrom(this._http.get<RawBase | null>(`/api/intersections/${id}/intersection_base/properties`));
    if (data) return cleanBase([data])[0];
    return null;
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

  public async getTrafficSignalsByTrafficSignalClusterId(trafficSignalClusterId: number): Promise<FeatureCollection<Point>> {
    const data = await firstValueFrom(this._http.get<FeatureCollection<Point>>(`/api/osm/traffic-signals/cluster/${trafficSignalClusterId}`));
    processTrafficSignals(data);
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

  public async getIntersectionRegionMetricsPageable(request: RegionMetricRequest): Promise<PagedGeoResponse<Polygon>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    const data = await firstValueFrom(this._http.get<PagedGeoResponse<Polygon>>('/api/intersections/regions/pageable', { params }));
    processRegion(data.geoData);
    return data;
  }

  public async getIntersectionRideRegionMetricsProperties(request: RegionMetricRequest): Promise<PagedProperties<RideRegionMetric>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
		const data = await firstValueFrom(this._http.get<PagedProperties<RawRideRegionMetric>>('/api/intersections/regions/rides', { params }));
    
    const cleaned: PagedProperties<RideRegionMetric> = {
      metadata: data.metadata,
      properties: cleanRideRegionMetric(data.properties)
    };
    return cleaned;
  }
}

