import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IntersectionsRequestService } from './intersections-request.service';
import { FeatureCollection, Point, LineString, Polygon } from 'geojson';

@Injectable({
  providedIn: 'root'
})
export class IntersectionsDetailFacade {
  private readonly _intersectionsRequestService = inject(IntersectionsRequestService);


  public getIntersectionNodeFiltered(trafficSignalClusterId: number, startOsmId: number | null, endOsmId: number | null): Promise<FeatureCollection<LineString>> {
    return firstValueFrom(this._intersectionsRequestService.getIntersectionNodeFiltered(trafficSignalClusterId, startOsmId, endOsmId));
  }

  public getIntersectionEdgeFiltered(prevOsmId: number | null, osmId: number | null, nextOsmId: number | null): Promise<FeatureCollection<LineString>> {
    return firstValueFrom(this._intersectionsRequestService.getIntersectionEdgeFiltered(prevOsmId, osmId, nextOsmId));
  }
}
