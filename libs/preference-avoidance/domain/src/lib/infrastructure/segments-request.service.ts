import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
	SegmentEvent,
	SegmentEventsParams,
	SegmentGeoJson,
	SegmentGeoJsonParams,
	SegmentListParams,
	SegmentSummary,
} from '@simra/thesis-common';
import { omitBy, isNil } from 'lodash';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class SegmentsRequestService {
	private readonly _http = inject(HttpClient);

	public getSegmentsGeoJson(params: SegmentGeoJsonParams = {}): Observable<SegmentGeoJson> {
		return this._http.get<SegmentGeoJson>('/api/segments/geojson', {
			params: omitBy(params, isNil),
		});
	}

	public getSegments(params: SegmentListParams = {}): Observable<SegmentSummary[]> {
		return this._http.get<SegmentSummary[]>('/api/segments', {
			params: omitBy(params, isNil),
		});
	}

	public getSegment(segmentId: number): Observable<SegmentSummary> {
		return this._http.get<SegmentSummary>(`/api/segments/${segmentId}`);
	}

	public getSegmentEvents(segmentId: number, params: SegmentEventsParams = {}): Observable<SegmentEvent[]> {
		return this._http.get<SegmentEvent[]>(`/api/segments/${segmentId}/events`, {
			params: omitBy(params, isNil),
		});
	}
}
