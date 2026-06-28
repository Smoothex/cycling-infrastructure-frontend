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

export type TimeBucket = 'DAY' | 'WEEK' | 'MONTH';

export type SegmentEventType = 'AVOIDANCE' | 'PREFERENCE';

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

export interface TimeSeriesBucket {
	bucketStartEpochMillis: number;
	label: string;
	totalCount: number;
	avoidanceCount: number;
	preferenceCount: number;
	avoidanceShare?: number;
	preferenceShare?: number;
}

export interface AnalyticsDistributionParams {
	dimension?: AnalysisDimension;
	from?: number;
	to?: number;
	eventType?: SegmentEventType;
	limit?: number;
}

export interface AnalyticsTimeSeriesParams {
	bucket?: TimeBucket;
	from?: number;
	to?: number;
	eventType?: SegmentEventType;
}
