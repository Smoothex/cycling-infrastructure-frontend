import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { defaults, isEmpty, isNumber, omitBy, pickBy } from 'lodash';
import { FeatureCollection, LineString } from 'geojson';
import {
  PagedProperties,
  NodePageableMetricRequest, 
  PagedGeoResponse,
  RawBase,
  Base,
  cleanBase,
  NodeMetric,
  NodePageableRequest,
  NodeMetricRow,
  processIntersectionNodeMetricsProperties,
  ScrollProperties,
  NodeScrollRequest,
  NodeScrollMetricRequest,
  NodeMetricRequest,
  NodeRequest,
} from '@simra/intersections-common';

@Injectable({
  providedIn: 'root'
})
export class IntersectionsNodeRequestService {
  private readonly _http = inject(HttpClient);

  public async getIntersectionNode(id: number): Promise<FeatureCollection<LineString>> {
    return firstValueFrom(this._http.get<FeatureCollection<LineString>>(`/api/intersections/intersection_nodes/${id}`));
  }

  public async getIntersectionNodes(request: NodePageableRequest): Promise<PagedGeoResponse<LineString>> {
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

  public async getIntersectionNodePropertiesScroll(request: NodeScrollRequest): Promise<ScrollProperties<Base>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
		params["properties"] = true;
    const data = await firstValueFrom(this._http.get<ScrollProperties<RawBase>>('/api/intersections/intersection_nodes/scroll', { params }));
    const cleaned: ScrollProperties<Base> = {
      metadata: data.metadata,
      properties: cleanBase(data.properties)
    }
    return cleaned;
  }
  public async getIntersectionNodePropertiesCount(request: NodeRequest): Promise<number> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
		params["properties"] = true;
    return firstValueFrom(this._http.get<number>('/api/intersections/intersection_nodes/count', { params }));
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
  public async getIntersectionNodeMetricsPropertiesScroll(request: NodeScrollMetricRequest): Promise<ScrollProperties<NodeMetricRow>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    const data = await firstValueFrom(this._http.get<ScrollProperties<NodeMetric>>('/api/intersections/intersection_nodes/aggregate/scroll', { params }));
    const cleaned: ScrollProperties<NodeMetricRow> = {
      metadata: data.metadata,
      properties: processIntersectionNodeMetricsProperties(data.properties)
    }
    return cleaned;
  }
  public async getIntersectionNodeMetricsPropertiesCount(request: NodeMetricRequest): Promise<number> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    return firstValueFrom(this._http.get<number>('/api/intersections/intersection_nodes/aggregate/count', { params }));
  }

  public getIntersectionNodeStreetNames(request: NodePageableMetricRequest): Observable<string[]> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
		return this._http.get<string[]>('/api/intersections/intersection_nodes/streetNames', { params });
	}
}

