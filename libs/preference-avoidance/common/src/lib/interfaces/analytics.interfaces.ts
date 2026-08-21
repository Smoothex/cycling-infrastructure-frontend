import { SegmentEnrichmentFilter } from './segments.interfaces';
import { MultiLineString } from 'geojson';

export type AnalysisDimension =
	| 'EVENT_TYPE'
	| 'HOUR_OF_DAY'
	| 'DAY_OF_WEEK'
	| 'RIDE_INTENT'
	| 'WIND_EXPOSURE'
	| 'CYCLEWAY_TYPE'
	| 'CYCLEWAY_LOCATION'
	| 'HIGHWAY'
	| 'SURFACE'
	| 'SMOOTHNESS'
	| 'LIT'
	| 'WEATHER_CODE'
	| 'PRECIPITATION_BUCKET'
	| 'TEMPERATURE_BUCKET'
	| 'WIND_SPEED_BUCKET'
	| 'GRADIENT_BUCKET'
	| 'TRAFFIC_CONDITION'
	| 'TRAFFIC_VOLUME_BUCKET'
	| 'TRAFFIC_SPEED_BUCKET';

export type SegmentEventType = 'AVOIDANCE' | 'PREFERENCE';

export type RouteComparisonType = 'EQUIVALENT_ROUTE' | 'LOCAL_DETOUR' | 'CORRIDOR_ALTERNATIVE';

export type DetourImpactRouteComparisonType = Exclude<RouteComparisonType, 'EQUIVALENT_ROUTE'>;

export type InfrastructureDimension = 'SURFACE' | 'SMOOTHNESS' | 'CYCLEWAY_TYPE' | 'HIGHWAY';

export interface ProcessingSummary {
	totalRides: number;
	rideStatusCounts: Record<string, number>;
	totalSegments: number;
	observedSegments: number;
	totalSegmentEvents: number;
	earliestEventTimestamp?: number;
	latestEventTimestamp?: number;
	segmentEventTypeCounts: Record<string, number>;
	weatherEnrichedEvents: number;
	ohsomeEnrichedEvents: number;
	berlinOpenDataEnrichedEvents: number;
	trafficEnrichedEvents: number;
	trafficMeasuredEvents: number;
}

export interface DimensionBucket {
	dimension: string;
	value: string;
	totalCount: number;
	avoidanceCount: number;
	preferenceCount: number;
	avoidanceShare?: number;
	preferenceShare?: number;
	averageTemperature2m?: number;
	averagePrecipitation?: number;
	averageWindSpeed10m?: number;
	averageRelativeWindAngleDegrees?: number;
	averageGradientPercent?: number;
	averageTrafficVolumeKfz?: number;
	averageTrafficSpeedKfz?: number;
}

export interface AnalyticsContext {
	matchingRideCount: number;
	matchingEventCount: number;
	avoidanceEventCount: number;
	preferenceEventCount: number;
	earliestEventTimestamp?: number;
	latestEventTimestamp?: number;
}

export interface RouteComparisonSummary {
	classifiedRideCount: number;
	detourThresholdRatio: number;
	maximumEquivalentExcessDistanceMeters: number;
	minimumOverlapRatio: number;
	routeComparisonTypeCounts: Record<RouteComparisonType, number>;
	detourImpact: RouteComparisonDetourImpact[];
}

export interface RouteComparisonDetourImpact {
	routeComparisonType: DetourImpactRouteComparisonType;
	eligibleRideCount: number;
	lowerQuartilePercent: number;
	medianPercent: number;
	upperQuartilePercent: number;
}

export interface CorridorRanking {
	streetName: string;
	avoidanceRideCount: number;
	preferenceRideCount: number;
	avoidanceEventCount: number;
	preferenceEventCount: number;
	segmentCount: number;
	scaryIncidentCount: number;
	minLon?: number;
	minLat?: number;
	maxLon?: number;
	maxLat?: number;
	topSegmentId?: number;
	segmentIds: number[];
}

export interface CorridorGeometry {
	streetName: string;
	segmentIds: number[];
	geometry: MultiLineString;
}

export interface InfrastructureSignalBucket {
	value: string;
	avoidanceRideCount: number;
	preferenceRideCount: number;
	totalRideSignals: number;
	avoidanceShare?: number;
	percentagePointDifference?: number;
}

export interface InfrastructureSignals {
	dimension: InfrastructureDimension;
	matchingEventCount: number;
	knownAttributeEventCount: number;
	coverageShare?: number;
	baselineAvoidanceShare?: number;
	buckets: InfrastructureSignalBucket[];
}

/** Filters whose semantics are supported by every analytics insight. */
export interface AnalyticsFilters {
	from?: number;
	to?: number;
	rideIntent?: string;
}

export interface AnalyticsDistributionParams extends AnalyticsFilters {
	trafficCondition?: string;
	enrichmentFilters?: SegmentEnrichmentFilter[];
	dimension?: AnalysisDimension;
	eventType?: SegmentEventType;
	limit?: number;
}

export type AnalyticsContextParams = AnalyticsFilters;

export type AnalyticsRouteComparisonParams = AnalyticsFilters;

export interface AnalyticsCorridorsParams extends AnalyticsFilters {
	rank?: SegmentEventType;
	limit?: number;
	minRideCount?: number;
}

export interface AnalyticsCorridorGeometryParams {
	streetName: string;
	minLon: number;
	minLat: number;
	maxLon: number;
	maxLat: number;
}

export interface AnalyticsInfrastructureSignalsParams extends AnalyticsFilters {
	dimension?: InfrastructureDimension;
	limit?: number;
	minRideCount?: number;
}
