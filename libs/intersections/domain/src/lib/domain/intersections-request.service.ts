import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { defaults, isEmpty, isNumber, omitBy, pickBy } from 'lodash';
import { FeatureCollection, Point, LineString, Polygon } from 'geojson';
import {
  PagedIds,
  PagedProperties,
  IdListRequest,
  NodePageableMetricRequest, 
  EdgePageableMetricRequest,
  RegionPageableRequest,
  MetricRequest,
  PagedGeoResponse,
  RawBase,
  Base,
  BaseRequest,
  cleanBase,
  EdgeMetric,
  NodeMetric,
  RawRideRegionMetric,
  RideRegionMetric,
  cleanRideRegionMetric,
  NodePageableRequestPrecomputed,
  NodePageableRequestStartEndDate,
  EdgePageableRequestPrecomputed,
  EdgePageableRequestStartEndDate,
  NodeMetricRow,
  EdgeMetricRow,
  RegionMetricRow,
  RegionCompleteRequest
} from '@simra/intersections-common';
import {
  processIntersectionNodeMetricsProperties,
  processIntersectionEdgeMetricsProperties,
  processRegionMetricsProperties
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
    return firstValueFrom(this._http.get<FeatureCollection<Point>>(`/api/intersections/${id}/points`));
  }

  public async getMatchedPoints(id: number): Promise<FeatureCollection<Point>> {
    return firstValueFrom(this._http.get<FeatureCollection<Point>>(`/api/intersections/${id}/matched_points`));
  }

  public async getIntersectionEdge(id: number): Promise<FeatureCollection<LineString>> {
    return firstValueFrom(this._http.get<FeatureCollection<LineString>>(`/api/intersections/${id}/intersection_edges`));
  }

  public async getIntersectionNode(id: number): Promise<FeatureCollection<LineString>> {
    return firstValueFrom(this._http.get<FeatureCollection<LineString>>(`/api/intersections/${id}/intersection_nodes`));
  }

  public async getIntersectionNodes(request: NodePageableRequestPrecomputed | NodePageableRequestStartEndDate): Promise<PagedGeoResponse<LineString>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    params["properties"] = false;
		return firstValueFrom(this._http.get<PagedGeoResponse<LineString>>('/api/intersections/intersection_nodes', { params }));
  }
  public async getIntersectionNodeProperties(request: NodePageableRequestPrecomputed | NodePageableRequestStartEndDate): Promise<PagedProperties<Base>> {
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
		params["properties"] = false;
    return firstValueFrom(this._http.get<PagedGeoResponse<LineString>>('/api/intersections/intersection_nodes/aggregate', { params }));
  }
  public async getIntersectionNodeMetricsPageableProperties(request: NodePageableMetricRequest): Promise<PagedProperties<NodeMetricRow>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
		params["properties"] = true;
    const data = await firstValueFrom(this._http.get<PagedProperties<NodeMetric>>('/api/intersections/intersection_nodes/aggregate', { params }));
    const cleaned: PagedProperties<NodeMetricRow> = {
      metadata: data.metadata,
      properties: processIntersectionNodeMetricsProperties(data.properties)
    }
    return cleaned;
  }

  public getIntersectionNodeStreetNames(request: NodePageableMetricRequest): Observable<string[]> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
		return this._http.get<string[]>('/api/intersections/intersection_nodes/streetNames', { params });
	}

  public async getIntersectionEdges(request: EdgePageableRequestPrecomputed | EdgePageableRequestStartEndDate): Promise<PagedGeoResponse<LineString>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    params["properties"] = false;
		return firstValueFrom(this._http.get<PagedGeoResponse<LineString>>('/api/intersections/intersection_edges', { params }));
  }
  public async getIntersectionEdgeProperties(request: EdgePageableRequestPrecomputed | EdgePageableRequestStartEndDate): Promise<PagedProperties<Base>> {
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
    params["properties"] = false;
    return firstValueFrom(this._http.get<PagedGeoResponse<LineString>>('/api/intersections/intersection_edges/aggregate', { params }));
  }
  public async getIntersectionEdgeMetricsPageableProperties(request: EdgePageableMetricRequest): Promise<PagedProperties<EdgeMetricRow>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    params["properties"] = true;
    const data = await firstValueFrom(this._http.get<PagedProperties<EdgeMetric>>('/api/intersections/intersection_edges/aggregate', { params }));
    const cleaned: PagedProperties<EdgeMetricRow> = {
      metadata: data.metadata,
      properties: processIntersectionEdgeMetricsProperties(data.properties)
    }
    return cleaned;
  }

  public getIntersectionEdgeStreetNames(request: EdgePageableMetricRequest): Observable<string[]> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
		return this._http.get<string[]>('/api/intersections/intersection_edges/streetNames', { params });
  }

  public async getIntersectionBasePropertiesSingular(id: number): Promise<FeatureCollection<LineString> | null> {
    return firstValueFrom(this._http.get<FeatureCollection<LineString> | null>(`/api/intersections/${id}/intersection_base`));
  }

  public async getMatchedPointsIntersectionBase(request: BaseRequest): Promise<FeatureCollection<Point>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    return firstValueFrom(this._http.get<FeatureCollection<Point>>('/api/intersections/intersection_base/matched_points', { params }));
  }
  
  public async getRidePointsIntersectionBase(request: BaseRequest): Promise<FeatureCollection<Point>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    return firstValueFrom(this._http.get<FeatureCollection<Point>>('/api/intersections/intersection_base/ride_points', { params }));
  }

  public async getTrafficSignalsByTrafficSignalClusterId(trafficSignalClusterId: number): Promise<FeatureCollection<Point>> {
    return firstValueFrom(this._http.get<FeatureCollection<Point>>(`/api/osm/traffic-signals/cluster/${trafficSignalClusterId}`));
  }

  public async getTrafficSignalClustersByTrafficSignalClusterId(trafficSignalClusterId: number): Promise<FeatureCollection<Polygon>> {
    return firstValueFrom(this._http.get<FeatureCollection<Polygon>>(`/api/osm/cluster-polygons/${trafficSignalClusterId}`));
  }

  public async getIntersectionRegionMetricsComplete(request: RegionCompleteRequest): Promise<FeatureCollection<Polygon>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    return firstValueFrom(this._http.get<FeatureCollection<Polygon>>('/api/intersections/regions/complete', { params }));
  }

  public async getIntersectionRegionMetricsPageable(request: RegionPageableRequest): Promise<PagedGeoResponse<Polygon>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    params["properties"] = false;
    return firstValueFrom(this._http.get<PagedGeoResponse<Polygon>>('/api/intersections/regions/pageable', { params }));
  }

  public async getIntersectionRegionMetricsPageableProperties(request: RegionPageableRequest): Promise<PagedProperties<RegionMetricRow>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    params["properties"] = true;
    const data = await firstValueFrom(this._http.get<PagedProperties<RegionMetricRow>>('/api/intersections/regions/pageable', { params }));
    const withLinks: PagedProperties<RegionMetricRow> = {
      metadata: data.metadata,
      properties: processRegionMetricsProperties(data.properties)
    } 
    return withLinks;
  }

  public async getIntersectionRideRegionMetricsProperties(request: RegionPageableRequest): Promise<PagedProperties<RideRegionMetric>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
		const data = await firstValueFrom(this._http.get<PagedProperties<RawRideRegionMetric>>('/api/intersections/regions/rides', { params }));
    
    const cleaned: PagedProperties<RideRegionMetric> = {
      metadata: data.metadata,
      properties: cleanRideRegionMetric(data.properties)
    };
    return cleaned;
  }
}

