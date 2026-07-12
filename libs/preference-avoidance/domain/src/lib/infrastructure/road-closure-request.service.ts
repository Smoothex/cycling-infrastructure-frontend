import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { RoadClosure, RoadClosuresParams } from '@simra/preference-avoidance-common';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class RoadClosureRequestService {
	private readonly _http = inject(HttpClient);

	public getRoadClosures(params: RoadClosuresParams = {}): Observable<RoadClosure[]> {
		return this._http.get<RoadClosure[]>('/api/road-closures', {
			params: Object.entries(params).reduce<Record<string, number>>((cleanedParams, [key, value]) => {
				if (value !== undefined) {
					cleanedParams[key] = value;
				}
				return cleanedParams;
			}, {}),
		});
	}
}
