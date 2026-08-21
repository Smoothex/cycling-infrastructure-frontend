import { LineString } from 'geojson';
import { RouteComparisonType } from './analytics.interfaces';

export type ManualRouteComparisonClassification = RouteComparisonType | 'UNCERTAIN' | 'UNUSABLE';

export type RouteComparisonReviewIssue =
	| 'MAP_MATCHING_ERROR'
	| 'IMPLAUSIBLE_REFERENCE_ROUTE'
	| 'LIKELY_INTERMEDIATE_STOP'
	| 'INCORRECT_DIVERGENT_SEGMENTS'
	| 'POOR_GPS_QUALITY'
	| 'OTHER';

export interface RouteReview {
	manualClassification: ManualRouteComparisonClassification;
	issueCodes: RouteComparisonReviewIssue[];
	notes?: string;
	reviewedAt: number;
}

export interface RouteReviewSampleItem {
	rideId: string;
	sampleOrder: number;
	classSampleRank: number;
	automatedClassification: RouteComparisonType;
	startTimestamp?: number;
	rideIntent?: string;
	bikeType?: string;
	actualDistanceMeters?: number;
	shortestPathDistanceMeters?: number;
	absoluteExcessDistanceMeters?: number;
	relativeDetourRatio?: number;
	overlapRatio?: number;
	review?: RouteReview;
}

export interface RouteReviewSample {
	sampleSizePerType: number;
	totalItems: number;
	reviewedItems: number;
	representativeOfPrevalence: false;
	items: RouteReviewSampleItem[];
}

export interface RouteReviewSignal {
	eventId: string;
	segmentId: number;
	eventType: 'AVOIDANCE' | 'PREFERENCE';
	streetName?: string;
	geometry: LineString;
}

export interface RouteReviewDetail extends RouteReviewSampleItem {
	endTimestamp?: number;
	durationSeconds?: number;
	medianGpsAccuracyMeters?: number;
	gpsPointCount?: number;
	detourThresholdRatio: number;
	maximumEquivalentExcessDistanceMeters: number;
	minimumOverlapRatio: number;
	observedRoute: LineString;
	shortestRoute: LineString;
	signals: RouteReviewSignal[];
}

export interface SaveRouteReviewRequest {
	manualClassification: ManualRouteComparisonClassification;
	issueCodes: RouteComparisonReviewIssue[];
	notes?: string;
}
