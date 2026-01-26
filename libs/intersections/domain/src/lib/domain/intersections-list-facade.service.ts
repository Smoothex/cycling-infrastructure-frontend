import { inject, Injectable } from '@angular/core';
import { firstValueFrom, Observable } from 'rxjs';
import { IntersectionNodeAggregateRequest, IntersectionEdgeAggregateRequest } from '@simra/intersections-common';
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

  public getIntersectionNodeAggregateWithFilter(request: IntersectionNodeAggregateRequest): Promise<FeatureCollection<LineString>> {
    return firstValueFrom(this._intersectionsRequestService.getIntersectionNodeAggregateWithFilter(request));
  }

  public getIntersectionNodeStreetNames(request: IntersectionNodeAggregateRequest): Observable<string[]> {
		return this._intersectionsRequestService.getIntersectionNodeStreetNames(request);
	}

  public getIntersectionEdgeAggregateWithFilter(request: IntersectionNodeAggregateRequest): Promise<FeatureCollection<LineString>> {
    return firstValueFrom(this._intersectionsRequestService.getIntersectionEdgeAggregateWithFilter(request));
  }

  public getIntersectionEdgeStreetNames(request: IntersectionEdgeAggregateRequest): Observable<string[]> {
		return this._intersectionsRequestService.getIntersectionEdgeStreetNames(request);
	}
}
