import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
	AnalyticsDistributionParams,
	AnalyticsTimeSeriesParams,
	DimensionBucket,
	ProcessingSummary,
	TimeSeriesBucket,
} from '@simra/thesis-common';
import { omitBy, isNil } from 'lodash';
import { Observable } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class AnalyticsRequestService {
	private readonly _http = inject(HttpClient);

	public getSummary(): Observable<ProcessingSummary> {
		return this._http.get<ProcessingSummary>('/api/analytics/summary');
	}

	public getDistribution(params: AnalyticsDistributionParams = {}): Observable<DimensionBucket[]> {
		return this._http.get<DimensionBucket[]>('/api/analytics/distribution', {
			params: omitBy(params, isNil),
		});
	}

	public getTimeSeries(params: AnalyticsTimeSeriesParams = {}): Observable<TimeSeriesBucket[]> {
		return this._http.get<TimeSeriesBucket[]>('/api/analytics/time-series', {
			params: omitBy(params, isNil),
		});
	}
}
