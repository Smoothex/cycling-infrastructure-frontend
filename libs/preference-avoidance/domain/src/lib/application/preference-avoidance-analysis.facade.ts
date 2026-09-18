import { inject, Injectable } from '@angular/core';
import {
	AnalyticsContextParams,
	AnalyticsCorridorGeometryParams,
	AnalyticsCorridorsParams,
	AnalyticsDistributionParams,
	AnalyticsInfrastructureSignalsParams,
	AnalyticsRouteComparisonParams,
	NearMissIncidentsParams,
	RoadClosuresParams,
	SaveRouteReviewRequest,
	SegmentEventsParams,
	SegmentListParams,
	SegmentsGeoJsonParams,
} from '@simra/preference-avoidance-common';
import { AnalyticsRequestService } from '../infrastructure/analytics-request.service';
import { IncidentRequestService } from '../infrastructure/incident-request.service';
import { RoadClosureRequestService } from '../infrastructure/road-closure-request.service';
import { RouteReviewRequestService } from '../infrastructure/route-review-request.service';
import { SegmentsRequestService } from '../infrastructure/segments-request.service';
import { TrafficRequestService } from '../infrastructure/traffic-request.service';

@Injectable({ providedIn: 'root' })
export class PreferenceAvoidanceAnalysisFacade {
	private readonly _analyticsRequestService = inject(AnalyticsRequestService);
	private readonly _incidentRequestService = inject(IncidentRequestService);
	private readonly _roadClosureRequestService = inject(RoadClosureRequestService);
	private readonly _routeReviewRequestService = inject(RouteReviewRequestService);
	private readonly _segmentsRequestService = inject(SegmentsRequestService);
	private readonly _trafficRequestService = inject(TrafficRequestService);

	public getSummary() {
		return this._analyticsRequestService.getSummary();
	}

	public getFilterOptions() {
		return this._analyticsRequestService.getFilterOptions();
	}

	public getDistribution(params: AnalyticsDistributionParams) {
		return this._analyticsRequestService.getDistribution(params);
	}

	public getAnalyticsContext(params: AnalyticsContextParams) {
		return this._analyticsRequestService.getContext(params);
	}

	public getRouteComparisons(params: AnalyticsRouteComparisonParams) {
		return this._analyticsRequestService.getRouteComparisons(params);
	}

	public getCorridors(params: AnalyticsCorridorsParams) {
		return this._analyticsRequestService.getCorridors(params);
	}

	public getCorridorGeometry(params: AnalyticsCorridorGeometryParams) {
		return this._analyticsRequestService.getCorridorGeometry(params);
	}

	public getInfrastructureSignals(params: AnalyticsInfrastructureSignalsParams) {
		return this._analyticsRequestService.getInfrastructureSignals(params);
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

	public getRouteReviewSample() {
		return this._routeReviewRequestService.getSample();
	}

	public getRouteReviewDetail(rideId: string) {
		return this._routeReviewRequestService.getDetail(rideId);
	}

	public getRouteComparisonDetail(rideId: string) {
		return this._routeReviewRequestService.getRideDetail(rideId);
	}

	public saveRouteReview(rideId: string, request: SaveRouteReviewRequest) {
		return this._routeReviewRequestService.saveReview(rideId, request);
	}
}
