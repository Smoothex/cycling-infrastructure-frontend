import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { IntersectionNodeMetricsPageableRequest, IntersectionEdgeAggregateRequest, PagedGeoResponse } from '@simra/intersections-common';
import { IntersectionsRequestService } from './intersections-request.service';
import { RegionRequestService } from '../../../../../streets/domain/src/lib/infrastructure/region-request.service';
import { FeatureCollection, Point, LineString, Polygon } from 'geojson';

@Injectable({
  providedIn: 'root'
})
export class IntersectionsListFacade {
  private readonly _intersectionsRequestService = inject(IntersectionsRequestService);
  private readonly _regionRequestService = inject(RegionRequestService);

  public fetchRegionNames(prefix: string): Observable<string[]> {
		return this._regionRequestService.fetchRegionNames(prefix);
	}

  public getTrafficSignalPolygons(): Promise<FeatureCollection<Polygon>> {
    return firstValueFrom(this._intersectionsRequestService.getTrafficSignalPolygons());
  }

  public getIntersectionNodeAggregateWithFilter(request: IntersectionNodeMetricsPageableRequest): Promise<PagedGeoResponse<LineString>> {
    return firstValueFrom(this._intersectionsRequestService.getIntersectionNodeMetricsPageable(request));
  }

  public getIntersectionNodeStreetNames(request: IntersectionNodeMetricsPageableRequest): Observable<string[]> {
		return this._intersectionsRequestService.getIntersectionNodeStreetNames(request);
	}

  public getIntersectionEdgeAggregateWithFilter(request: IntersectionNodeMetricsPageableRequest): Promise<PagedGeoResponse<LineString>> {
    return firstValueFrom(this._intersectionsRequestService.getIntersectionEdgeMetricsPageable(request));
  }

  public getIntersectionEdgeStreetNames(request: IntersectionEdgeAggregateRequest): Observable<string[]> {
		return this._intersectionsRequestService.getIntersectionEdgeStreetNames(request);
	}
}
