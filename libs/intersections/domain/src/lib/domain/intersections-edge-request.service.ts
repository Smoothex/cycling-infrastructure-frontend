import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { defaults, isEmpty, isNumber, omitBy, pickBy } from 'lodash';
import { FeatureCollection, LineString } from 'geojson';
import {
  PagedProperties,
  EdgePageableMetricRequest,
  PagedGeoResponse,
  RawBase,
  Base,
  cleanBase,
  EdgeMetric,
  EdgePageableRequest,
  EdgeMetricRow,
  processIntersectionEdgeMetricsProperties,
  ScrollProperties,
  EdgeScrollRequest,
  EdgeRequest,
  EdgeScrollMetricRequest,
  EdgeMetricRequest,
} from '@simra/intersections-common';

@Injectable({
  providedIn: 'root'
})
export class IntersectionsEdgeRequestService {
  private readonly _http = inject(HttpClient);

  

  public async getIntersectionEdge(id: number): Promise<FeatureCollection<LineString>> {
    return firstValueFrom(this._http.get<FeatureCollection<LineString>>(`/api/intersections/intersection_edges/${id}`));
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
  public async getIntersectionEdgePropertiesScroll(request: EdgeScrollRequest): Promise<ScrollProperties<Base>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    const data = await firstValueFrom(this._http.get<ScrollProperties<RawBase>>('/api/intersections/intersection_edges/scroll', { params }));
    const cleaned: ScrollProperties<Base> = {
      metadata: data.metadata,
      properties: cleanBase(data.properties)
    }
    return cleaned;
  }
  public async getIntersectionEdgePropertiesCount(request: EdgeRequest): Promise<number> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    return firstValueFrom(this._http.get<number>('/api/intersections/intersection_edges/count', { params }));
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
  public async getIntersectionEdgeMetricsPropertiesScroll(request: EdgeScrollMetricRequest): Promise<ScrollProperties<EdgeMetricRow>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    const data = await firstValueFrom(this._http.get<ScrollProperties<EdgeMetric>>('/api/intersections/intersection_edges/aggregate/scroll', { params }));
    const cleaned: ScrollProperties<EdgeMetricRow> = {
      metadata: data.metadata,
      properties: processIntersectionEdgeMetricsProperties(data.properties)
    }
    return cleaned;
  }
  public async getIntersectionEdgeMetricsPropertiesCount(request: EdgeMetricRequest): Promise<number> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    return firstValueFrom(this._http.get<number>('/api/intersections/intersection_edges/aggregate/count', { params }));
  }

  public getIntersectionEdgeStreetNames(request: EdgePageableMetricRequest): Observable<string[]> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
		return this._http.get<string[]>('/api/intersections/intersection_edges/streetNames', { params });
  }
}

