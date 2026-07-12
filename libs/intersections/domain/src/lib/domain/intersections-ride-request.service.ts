import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { defaults, isEmpty, isNumber, omitBy, pickBy } from 'lodash';
import { FeatureCollection, Point, LineString } from 'geojson';
import {
  PagedIds,
  IdListRequest,
  BaseRequest,
  MatchedPointsAndRidePoints,
} from '@simra/intersections-common';

@Injectable({
  providedIn: 'root'
})
export class IntersectionsRideRequestService {
  private readonly _http = inject(HttpClient);

  
  public getIds(request: IdListRequest): Promise<PagedIds> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    return firstValueFrom(this._http.get<PagedIds>('/api/intersections/ride/ids', { params}));
  }

  public getRidePoints(id: number): Promise<FeatureCollection<Point>> {
    return firstValueFrom(this._http.get<FeatureCollection<Point>>(`/api/intersections/ride/points/${id}`));
  }

  public getMatchedPoints(id: number): Promise<FeatureCollection<Point>> {
    return firstValueFrom(this._http.get<FeatureCollection<Point>>(`/api/intersections/ride/matched_points/${id}`));
  }

  public getIntersectionBasePropertiesSingular(id: number): Promise<FeatureCollection<LineString> | null> {
    return firstValueFrom(this._http.get<FeatureCollection<LineString> | null>(`/api/intersections/ride/intersection_base/${id}`));
  }

  public getMatchedPointsAndRidePointsIntersectionBase(request: BaseRequest): Promise<MatchedPointsAndRidePoints> {
    const params = defaults(pickBy(request, isNumber), omitBy(request, isEmpty));
    return firstValueFrom(this._http.get<MatchedPointsAndRidePoints>('/api/intersections/ride/matched_points_and_ride_points', { params }));
  }
}

