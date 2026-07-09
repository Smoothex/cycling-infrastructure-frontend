import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { TrafficDetectorsResponse } from '@simra/preference-avoidance-common';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class TrafficRequestService {
	private readonly _http = inject(HttpClient);

	public getTrafficDetectors(): Observable<TrafficDetectorsResponse> {
		return this._http.get<TrafficDetectorsResponse>('/api/traffic/detectors');
	}
}
