import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IntersectionsRequestService } from './intersections-request.service';
import {
  RegionAggregateRequest,
  PagedGeoResponse
} from '@simra/intersections-common';
import { FeatureCollection, Polygon } from 'geojson';

@Injectable({
  providedIn: 'root'
})
export class IntersectionsRegionFacade {
  private readonly _intersectionsRequestService = inject(IntersectionsRequestService);


  public getRegionAggregate(request: RegionAggregateRequest): Promise<PagedGeoResponse<Polygon>> {
    return firstValueFrom(this._intersectionsRequestService.getIntersectionRegionMetricsPageable(request));
  }

  public getRegionByName(name: null | string = null): Promise<FeatureCollection<Polygon>> {
    return firstValueFrom(this._intersectionsRequestService.getRegionByName(name));
  }
}
