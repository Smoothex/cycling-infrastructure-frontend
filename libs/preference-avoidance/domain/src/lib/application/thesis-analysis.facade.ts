import { inject, Injectable } from '@angular/core';
import {
	AnalyticsDistributionParams,
	AnalyticsTimeSeriesParams,
	SegmentEventsParams,
	SegmentGeoJsonParams,
	SegmentListParams,
} from '@simra/thesis-common';
import { AnalyticsRequestService } from '../infrastructure/analytics-request.service';
import { SegmentsRequestService } from '../infrastructure/segments-request.service';

@Injectable({ providedIn: 'root' })
export class ThesisAnalysisFacade {
	private readonly _analyticsRequestService = inject(AnalyticsRequestService);
	private readonly _segmentsRequestService = inject(SegmentsRequestService);

	public getSummary() {
		return this._analyticsRequestService.getSummary();
	}

	public getDistribution(params: AnalyticsDistributionParams) {
		return this._analyticsRequestService.getDistribution(params);
	}

	public getTimeSeries(params: AnalyticsTimeSeriesParams) {
		return this._analyticsRequestService.getTimeSeries(params);
	}

	public getSegmentsGeoJson(params: SegmentGeoJsonParams) {
		return this._segmentsRequestService.getSegmentsGeoJson(params);
	}

	public getSegments(params: SegmentListParams) {
		return this._segmentsRequestService.getSegments(params);
	}

	public getSegment(segmentId: number) {
		return this._segmentsRequestService.getSegment(segmentId);
	}

	public getSegmentEvents(segmentId: number, params: SegmentEventsParams) {
		return this._segmentsRequestService.getSegmentEvents(segmentId, params);
	}
}
