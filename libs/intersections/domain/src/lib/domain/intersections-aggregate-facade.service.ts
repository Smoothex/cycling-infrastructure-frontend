import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { FeatureCollection, Point, LineString, Polygon } from 'geojson';
import { IntersectionsRequestService } from './intersections-request.service';
import { IntersectionNodeAggregateRequest, PagedGeoResponse } from '@simra/intersections-common';


@Injectable({
  providedIn: 'root'
})
export class IntersectionsAggregateFacade {
  private readonly _intersectionsRequestService = inject(IntersectionsRequestService);


  public getIntersectionNodeAggregateWithFilter(request: IntersectionNodeAggregateRequest): Promise<PagedGeoResponse<LineString>> {
    return firstValueFrom(this._intersectionsRequestService.getIntersectionNodeAggregateWithFilter(request));
  }

  public getTrafficSignalsByTrafficSignalClusterId(trafficSignalClusterId: number): Promise<FeatureCollection<Point>> {
    return firstValueFrom(this._intersectionsRequestService.getTrafficSignalsByTrafficSignalClusterId(trafficSignalClusterId));
  }

  public getTrafficSignalPolygonsByTrafficSignalClusterId(trafficSignalClusterId: number): Promise<FeatureCollection<Polygon>> {
    return firstValueFrom(this._intersectionsRequestService.getTrafficSignalPolygonsByTrafficSignalClusterId(trafficSignalClusterId));
  }
}
