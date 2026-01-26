import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IntersectionsRequestService } from './intersections-request.service';
import { FeatureCollection, Point, LineString, Polygon } from 'geojson';

@Injectable({
  providedIn: 'root'
})
export class IntersectionsAggregateFacade {
  private readonly _intersectionsRequestService = inject(IntersectionsRequestService);


  public getIntersectionNodeAggregateWithFilter(trafficSignalClusterId: number): Promise<FeatureCollection<LineString>> {
    return firstValueFrom(this._intersectionsRequestService.getIntersectionNodeAggregateWithFilter({trafficSignalClusterId: trafficSignalClusterId}));
  }

  public getTrafficSignalsByTrafficSignalClusterId(trafficSignalClusterId: number): Promise<FeatureCollection<Point>> {
    return firstValueFrom(this._intersectionsRequestService.getTrafficSignalsByTrafficSignalClusterId(trafficSignalClusterId));
  }

  public getTrafficSignalPolygonsByTrafficSignalClusterId(trafficSignalClusterId: number): Promise<FeatureCollection<Polygon>> {
    return firstValueFrom(this._intersectionsRequestService.getTrafficSignalPolygonsByTrafficSignalClusterId(trafficSignalClusterId));
  }
}
