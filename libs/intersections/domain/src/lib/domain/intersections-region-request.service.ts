import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { defaults, isEmpty, isNumber, omitBy, pickBy } from 'lodash';
import { FeatureCollection, Polygon } from 'geojson';
import {
  PagedProperties,
  PagedGeoResponse,
  RawRideRegionMetric,
  RideRegionMetric,
  cleanRideRegionMetric,
  TreeNode,
  RegionTreeNode,
  RegionMetricRow,
  RegionCompleteRequest,
  processRegionMetricsProperties,
  ScrollProperties,
  RegionPageableRequest,
  RegionScrollRequest,
  RegionRequest
} from '@simra/intersections-common';

function convertToTreeNodes(nodes: RegionTreeNode[]): TreeNode[] {
  return nodes.map(node => ({
    key: node.id.toString(),
    label: node.name,
    data: { ltreePath: node.ltreePath },
    children: node.children ? convertToTreeNodes(node.children) : []
  }));
}


@Injectable({
  providedIn: 'root'
})
export class IntersectionsRegionRequestService {
  private readonly _http = inject(HttpClient);

  public async getRegionTree(): Promise<TreeNode[]> { 
    const data = await firstValueFrom(this._http.get<RegionTreeNode[]>('/api/regions/regionTree'));
    return convertToTreeNodes(data);
  } 

  public getIntersectionRegionMetricsComplete(request: RegionCompleteRequest): Promise<FeatureCollection<Polygon>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    return firstValueFrom(this._http.get<FeatureCollection<Polygon>>('/api/intersections/regions/complete', { params }));
  }

  public getIntersectionRegionMetricsPageable(request: RegionPageableRequest): Promise<PagedGeoResponse<Polygon>> {
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

  public async getIntersectionRideRegionMetricsPropertiesScroll(request: RegionScrollRequest): Promise<ScrollProperties<RideRegionMetric>> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    const data = await firstValueFrom(this._http.get<ScrollProperties<RawRideRegionMetric>>('/api/intersections/regions/rides/scroll', { params }));
    const cleaned: ScrollProperties<RideRegionMetric> = {
      metadata: data.metadata,
      properties: cleanRideRegionMetric(data.properties)
    }
    return cleaned;
  }
  public getIntersectionRideRegionMetricsPropertiesCount(request: RegionRequest): Promise<number> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    return firstValueFrom(this._http.get<number>('/api/intersections/regions/rides/count', { params }));
  }
}

