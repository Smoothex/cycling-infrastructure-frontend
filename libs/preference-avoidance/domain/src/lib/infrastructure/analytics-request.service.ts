import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
	AnalyticsContext,
	AnalyticsContextParams,
	AnalyticsCorridorGeometryParams,
	AnalyticsCorridorsParams,
	AnalyticsDistributionParams,
	AnalyticsInfrastructureSignalsParams,
	CorridorRanking,
	CorridorGeometry,
	DimensionBucket,
	InfrastructureSignals,
	ProcessingSummary,
} from '@simra/preference-avoidance-common';
import { Observable } from 'rxjs';

type RequestParamValue = string | number | boolean | readonly (string | number | boolean)[];
type RequestParams = Record<string, RequestParamValue>;
type AnalyticsRequestParams =
	| AnalyticsDistributionParams
	| AnalyticsContextParams
	| AnalyticsCorridorGeometryParams
	| AnalyticsCorridorsParams
	| AnalyticsInfrastructureSignalsParams;

@Injectable({ providedIn: 'root' })
export class AnalyticsRequestService {
	private readonly _http = inject(HttpClient);

	public getSummary(): Observable<ProcessingSummary> {
		return this._http.get<ProcessingSummary>('/api/analytics/summary');
	}

	public getDistribution(params: AnalyticsDistributionParams = {}): Observable<DimensionBucket[]> {
		return this._http.get<DimensionBucket[]>('/api/analytics/distribution', {
			params: this.cleanParams(params),
		});
	}

	public getContext(params: AnalyticsContextParams = {}): Observable<AnalyticsContext> {
		return this._http.get<AnalyticsContext>('/api/analytics/context', {
			params: this.cleanParams(params),
		});
	}

	public getCorridors(params: AnalyticsCorridorsParams = {}): Observable<CorridorRanking[]> {
		return this._http.get<CorridorRanking[]>('/api/analytics/corridors', {
			params: this.cleanParams(params),
		});
	}

	public getCorridorGeometry(params: AnalyticsCorridorGeometryParams): Observable<CorridorGeometry> {
		return this._http.get<CorridorGeometry>('/api/analytics/corridor-geometry', {
			params: this.cleanParams(params),
		});
	}

	public getInfrastructureSignals(
		params: AnalyticsInfrastructureSignalsParams = {},
	): Observable<InfrastructureSignals> {
		return this._http.get<InfrastructureSignals>('/api/analytics/infrastructure-signals', {
			params: this.cleanParams(params),
		});
	}

	private cleanParams(params: AnalyticsRequestParams): RequestParams {
		return Object.entries(params).reduce<RequestParams>((cleanedParams, [key, value]) => {
			if (value === null || value === undefined || (Array.isArray(value) && value.length === 0)) {
				return cleanedParams;
			}

			cleanedParams[key] = value as RequestParamValue;
			return cleanedParams;
		}, {});
	}
}
