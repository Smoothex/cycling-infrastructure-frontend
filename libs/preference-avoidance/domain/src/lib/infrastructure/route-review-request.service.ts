import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
	RouteReview,
	RouteReviewDetail,
	RouteReviewSample,
	SaveRouteReviewRequest,
} from '@simra/preference-avoidance-common';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RouteReviewRequestService {
	private readonly _http = inject(HttpClient);

	public getSample(): Observable<RouteReviewSample> {
		return this._http.get<RouteReviewSample>('/api/route-comparisons/review-sample');
	}

	public getDetail(rideId: string): Observable<RouteReviewDetail> {
		return this._http.get<RouteReviewDetail>(
			`/api/route-comparisons/review-sample/${rideId}`,
		);
	}

	public saveReview(rideId: string, request: SaveRouteReviewRequest): Observable<RouteReview> {
		return this._http.put<RouteReview>(
			`/api/route-comparisons/review-sample/${rideId}/review`,
			request,
		);
	}
}
