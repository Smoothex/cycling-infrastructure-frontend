import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FeatureCollection, Point, LineString, Polygon } from 'geojson';
import { IntersectionsRequestService } from './intersections-request.service';
import { IntersectionNodeMetricsPageableRequest, PagedGeoResponse } from '@simra/intersections-common';


@Injectable({
  providedIn: 'root'
})
export class IntersectionsAggregateFacade {
  private readonly _intersectionsRequestService = inject(IntersectionsRequestService);


  public getIntersectionNodeAggregateWithFilter(request: IntersectionNodeMetricsPageableRequest): Promise<PagedGeoResponse<LineString>> {
    return firstValueFrom(this._intersectionsRequestService.getIntersectionNodeMetricsPageable(request));
  }

  public getTrafficSignalsByTrafficSignalClusterId(trafficSignalClusterId: number): Promise<FeatureCollection<Point>> {
    return firstValueFrom(this._intersectionsRequestService.getTrafficSignalsByTrafficSignalClusterId(trafficSignalClusterId));
  }

  public getTrafficSignalPolygonsByTrafficSignalClusterId(trafficSignalClusterId: number): Promise<FeatureCollection<Polygon>> {
    return firstValueFrom(this._intersectionsRequestService.getTrafficSignalPolygonsByTrafficSignalClusterId(trafficSignalClusterId));
  }
}
