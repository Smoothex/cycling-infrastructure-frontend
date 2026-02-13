import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { IntersectionsRequestService } from './intersections-request.service';
import { FeatureCollection, Point, LineString, Polygon } from 'geojson';
import {
	IntersectionNodeAggregateRequest, 
	IntersectionEdgeAggregateRequest,
	PagedGeoResponse
} from '@simra/intersections-common';

@Injectable({
  providedIn: 'root'
})
export class IntersectionsMapFacade {
  private readonly _intersectionsRequestService = inject(IntersectionsRequestService);

  public getIds(): Promise<number[]> {
    return firstValueFrom(this._intersectionsRequestService.getIds());
  }

  public getRidePoints(id: number): Promise<FeatureCollection<Point>> {
    return firstValueFrom(this._intersectionsRequestService.getRidePoints(id));
  }

  public getMatchedPoints(id: number): Promise<FeatureCollection<Point>> {
    return firstValueFrom(this._intersectionsRequestService.getMatchedPoints(id));
  }

  public getIntersectionEdge(id: number): Promise<FeatureCollection<LineString>> {
    return firstValueFrom(this._intersectionsRequestService.getIntersectionEdge(id));
  }

  public getIntersectionNode(id: number): Promise<FeatureCollection<LineString>> {
    return firstValueFrom(this._intersectionsRequestService.getIntersectionNode(id));
  }

  public getIntersectionNodeAggregate(request: IntersectionNodeAggregateRequest): Promise<PagedGeoResponse<LineString>> {
    return firstValueFrom(this._intersectionsRequestService.getIntersectionNodeAggregateWithFilter(request));
  }

  public getIntersectionEdgeAggregate(request: IntersectionEdgeAggregateRequest): Promise<PagedGeoResponse<LineString>> {
    return firstValueFrom(this._intersectionsRequestService.getIntersectionEdgeAggregateWithFilter(request));
  }

  public getRideIdsByOsmId(osmId: number): Promise<number[]> {
    return firstValueFrom(this._intersectionsRequestService.getRideIdsByOsmId(osmId));
  }

  public getTrafficSignalsByOsmId(osmId: number): Promise<FeatureCollection<Point>> {
    return firstValueFrom(this._intersectionsRequestService.getTrafficSignalsByOsmId(osmId));
  }

  public getTrafficSignals(): Promise<FeatureCollection<Point>> {
    return firstValueFrom(this._intersectionsRequestService.getTrafficSignals());
  }

  public getTrafficSignalPolygons(): Promise<FeatureCollection<Polygon>> {
    return firstValueFrom(this._intersectionsRequestService.getTrafficSignalPolygons());
  }

  public getRegions(): Promise<FeatureCollection<Polygon>> {
    return firstValueFrom(this._intersectionsRequestService.getRegionAggregate());
  }
}
