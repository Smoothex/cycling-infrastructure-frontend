import { FeatureCollection, LineString } from 'geojson';
import { SegmentEventType } from './analytics.interfaces';

export interface SegmentTrafficStats {
	segmentId: number;
	trafficEnrichedEventCount: number;
	trafficMeasuredEventCount: number;
	averageTrafficVolumeKfz?: number;
	averageTrafficSpeedKfz?: number;
	averageTrafficVolumePkw?: number;
	averageTrafficSpeedPkw?: number;
	averageTrafficVolumeLkw?: number;
	averageTrafficSpeedLkw?: number;
	dominantTrafficCondition?: string;
}

export interface SegmentSummary {
	id: number;
	streetName: string;
	usageCount: number;
	avoidanceCount: number;
	avoidanceRatio?: number;
	preferenceCount: number;
	preferenceRatio?: number;
	totalObservationCount: number;
	gradientPercent?: number;
	traffic?: SegmentTrafficStats;
	incidentCount: number;
	incidentBreakdown: IncidentBreakdown[];
	externalFactors: ExternalFactor[];
	geometry?: LineString;
}

export interface IncidentBreakdown {
	incidentType: string;
	count: number;
}

export interface ExternalFactor {
	factorType: string;
	source: string;
	validFrom?: number;
	validTo?: number;
	metadata?: Record<string, unknown>;
}

export interface TileStatus {
	state: 'IDLE' | 'RUNNING' | 'FAILED';
	generatedAt?: number;
	lastError?: string;
}

export type RiskBucket =
	| 'PREFERENCE_EXTREME'
	| 'PREFERENCE_STRONG'
	| 'PREFERENCE'
	| 'PREFERENCE_LIGHT'
	| 'BASELINE'
	| 'AVOIDANCE_LIGHT'
	| 'AVOIDANCE'
	| 'AVOIDANCE_STRONG'
	| 'AVOIDANCE_EXTREME'
	| 'NO_EVENTS';

/**
 * Feature properties baked into the 'segments' layer of the PMTiles tileset.
 * The 'streets' overview layer carries the same properties minus id,
 * avoidanceRatio, preferenceRatio and gradientPercent.
 * Additionally each feature carries dynamic per-year properties
 * (`eventCount_<year>`, `bucket_<year>`) for every year it has events in.
 */
export interface SegmentTileProperties {
	id: number;
	streetName?: string;
	usageCount: number;
	avoidanceCount: number;
	preferenceCount: number;
	avoidanceRatio?: number;
	preferenceRatio?: number;
	totalObservationCount: number;
	gradientPercent?: number;
	eventCount: number;
	balance: number;
	bucket: RiskBucket;
	trafficEnrichedEventCount: number;
	weatherEnrichedEventCount: number;
	ohsomeEnrichedEventCount: number;
	trafficMeasuredEventCount: number;
	roadDisruptionAffectedEventCount: number;
}

export interface SegmentEventFilters {
	/** epoch millis; with from/to only segments with an event in the window are returned */
	from?: number;
	to?: number;
	enrichmentFilters?: SegmentEnrichmentFilter[];
	rideIntent?: string;
	trafficCondition?: string;
}

export interface SegmentListParams extends SegmentEventFilters {
	minAvoidanceRatio?: number;
	minSampleSize?: number;
	limit?: number;
}

export interface SegmentEventsParams extends SegmentEventFilters {
	eventType?: SegmentEventType;
	limit?: number;
}

export interface SegmentsGeoJsonParams extends SegmentEventFilters {
	minAvoidanceRatio?: number;
	minPreferenceRatio?: number;
	minSampleSize?: number;
	/** "minLon,minLat,maxLon,maxLat" */
	bbox?: string;
	limit?: number;
}

/** Feature properties emitted by GET /api/segments/geojson. */
export interface SegmentGeoJsonProperties {
	id: number;
	streetName?: string;
	usageCount: number;
	avoidanceCount: number;
	avoidanceRatio?: number;
	preferenceCount: number;
	preferenceRatio?: number;
	totalObservationCount: number;
	gradientPercent?: number;
	traffic?: SegmentTrafficStats;
}

export type SegmentsGeoJson = FeatureCollection<LineString, SegmentGeoJsonProperties>;

export type SegmentEnrichmentFilter =
	| 'TRAFFIC_ENRICHED'
	| 'WEATHER_ENRICHED'
	| 'OHSOME_ENRICHED'
	| 'TRAFFIC_MEASURED'
	| 'ROAD_DISRUPTION_AFFECTED';

export interface SegmentEvent {
	id: string;
	segmentId: number;
	rideId?: string;
	eventType: SegmentEventType;
	eventTimestamp: number;
	dayOfWeek?: string;
	hourOfDay?: number;
	rideIntent?: string;
	bikeType?: string;
	pathBearingDegrees?: number;
	highway?: string;
	surface?: string;
	smoothness?: string;
	lit?: string;
	cyclewayType?: string;
	cyclewayLocation?: string;
	cyclewaySurface?: string;
	cyclewayWidth?: number;
	bicycleOneway?: boolean;
	weatherEnriched: boolean;
	temperature2m?: number;
	precipitation?: number;
	windSpeed10m?: number;
	windDirection10m?: number;
	weatherCode?: number;
	relativeWindAngleDegrees?: number;
	windExposure?: string;
	ohsomeEnriched: boolean;
	trafficEnriched: boolean;
	trafficEnrichmentStatus?: string;
	trafficCondition?: string;
	trafficSourceType?: string;
	trafficVolumeKfz?: number;
	trafficSpeedKfz?: number;
	trafficVolumePkw?: number;
	trafficSpeedPkw?: number;
	trafficVolumeLkw?: number;
	trafficSpeedLkw?: number;
	roadDisruptions: ExternalFactor[];
}
