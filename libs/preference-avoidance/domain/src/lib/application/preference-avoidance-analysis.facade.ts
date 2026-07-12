import { inject, Injectable } from '@angular/core';
import {
	AnalyticsDistributionParams,
	AnalyticsTimeSeriesParams,
	NearMissIncidentsParams,
	RoadClosuresParams,
	SegmentEventsParams,
	SegmentListParams,
	SegmentsGeoJsonParams,
} from '@simra/preference-avoidance-common';
import { AnalyticsRequestService } from '../infrastructure/analytics-request.service';
import { IncidentRequestService } from '../infrastructure/incident-request.service';
import { RoadClosureRequestService } from '../infrastructure/road-closure-request.service';
import { SegmentsRequestService } from '../infrastructure/segments-request.service';
import { TrafficRequestService } from '../infrastructure/traffic-request.service';

@Injectable({ providedIn: 'root' })
export class PreferenceAvoidanceAnalysisFacade {
	private readonly _analyticsRequestService = inject(AnalyticsRequestService);
	private readonly _incidentRequestService = inject(IncidentRequestService);
	private readonly _roadClosureRequestService = inject(RoadClosureRequestService);
	private readonly _segmentsRequestService = inject(SegmentsRequestService);
	private readonly _trafficRequestService = inject(TrafficRequestService);

	public getSummary() {
		return this._analyticsRequestService.getSummary();
	}

	public getDistribution(params: AnalyticsDistributionParams) {
		return this._analyticsRequestService.getDistribution(params);
	}

	public getTimeSeries(params: AnalyticsTimeSeriesParams) {
		return this._analyticsRequestService.getTimeSeries(params);
	}

	public getTileStatus() {
		return this._segmentsRequestService.getTileStatus();
	}

	public getSegments(params: SegmentListParams) {
		return this._segmentsRequestService.getSegments(params);
	}

	public getSegmentsGeoJson(params: SegmentsGeoJsonParams) {
		return this._segmentsRequestService.getSegmentsGeoJson(params);
	}

	public getSegment(segmentId: number) {
		return this._segmentsRequestService.getSegment(segmentId);
	}

	public getSegmentEvents(segmentId: number, params: SegmentEventsParams) {
		return this._segmentsRequestService.getSegmentEvents(segmentId, params);
	}

	public getTrafficDetectors() {
		return this._trafficRequestService.getTrafficDetectors();
	}

	public getNearMissIncidents(params: NearMissIncidentsParams) {
		return this._incidentRequestService.getNearMissIncidents(params);
	}

	public getRoadClosures(params: RoadClosuresParams) {
		return this._roadClosureRequestService.getRoadClosures(params);
	}
}
