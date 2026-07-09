import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
	SegmentEvent,
	SegmentEventsParams,
	SegmentListParams,
	SegmentsGeoJson,
	SegmentsGeoJsonParams,
	SegmentSummary,
	TileStatus,
} from '@simra/preference-avoidance-common';
import { Observable } from 'rxjs';

type RequestParamValue = string | number | boolean | readonly (string | number | boolean)[];
type RequestParams = Record<string, RequestParamValue>;
type SegmentRequestParams = SegmentListParams | SegmentEventsParams | SegmentsGeoJsonParams;

@Injectable({ providedIn: 'root' })
export class SegmentsRequestService {
	private readonly _http = inject(HttpClient);

	public getTileStatus(): Observable<TileStatus> {
		return this._http.get<TileStatus>('/api/tiles/status');
	}

	public getSegments(params: SegmentListParams = {}): Observable<SegmentSummary[]> {
		return this._http.get<SegmentSummary[]>('/api/segments', {
			params: this.cleanParams(params),
		});
	}

	public getSegmentsGeoJson(params: SegmentsGeoJsonParams = {}): Observable<SegmentsGeoJson> {
		return this._http.get<SegmentsGeoJson>('/api/segments/geojson', {
			params: this.cleanParams(params),
		});
	}

	public getSegment(segmentId: number): Observable<SegmentSummary> {
		return this._http.get<SegmentSummary>(`/api/segments/${segmentId}`);
	}

	public getSegmentEvents(segmentId: number, params: SegmentEventsParams = {}): Observable<SegmentEvent[]> {
		return this._http.get<SegmentEvent[]>(`/api/segments/${segmentId}/events`, {
			params: this.cleanParams(params),
		});
	}

	private cleanParams(params: SegmentRequestParams): RequestParams {
		return Object.entries(params).reduce<RequestParams>((cleanedParams, [key, value]) => {
			if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
				return cleanedParams;
			}

			cleanedParams[key] = value as RequestParamValue;
			return cleanedParams;
		}, {});
	}
}
