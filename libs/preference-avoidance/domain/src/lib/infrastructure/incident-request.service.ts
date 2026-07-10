import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { NearMissIncident, NearMissIncidentsParams } from '@simra/preference-avoidance-common';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class IncidentRequestService {
	private readonly _http = inject(HttpClient);

	public getNearMissIncidents(params: NearMissIncidentsParams = {}): Observable<NearMissIncident[]> {
		return this._http.get<NearMissIncident[]>('/api/incidents/near-misses', {
			params: Object.entries(params).reduce<Record<string, number>>((cleanedParams, [key, value]) => {
				if (value !== undefined) {
					cleanedParams[key] = value;
				}
				return cleanedParams;
			}, {}),
		});
	}
}
