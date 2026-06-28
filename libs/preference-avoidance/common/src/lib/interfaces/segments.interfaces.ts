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

export interface SegmentGeoJsonProperties {
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
}

export type SegmentGeoJson = FeatureCollection<LineString, SegmentGeoJsonProperties>;

export interface SegmentGeoJsonParams {
	minAvoidanceRatio?: number;
	minPreferenceRatio?: number;
	minSampleSize?: number;
	bbox?: string;
	limit?: number;
}

export interface SegmentListParams {
	minAvoidanceRatio?: number;
	minSampleSize?: number;
	limit?: number;
}

export interface SegmentEventsParams {
	eventType?: SegmentEventType;
	from?: number;
	to?: number;
	limit?: number;
}

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
}
