import { DecimalPipe } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	resource,
	signal,
	ViewEncapsulation,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MapPage } from '@simra/common-components';
import { APP_CONFIG } from '@simra/common-models';
import {
	SegmentEnrichmentFilter,
	SegmentEvent,
	SegmentEventType,
	SegmentsGeoJson,
	SegmentSummary,
	SegmentTileProperties,
	TileStatus,
	TrafficDetector,
	TrafficDetectorsResponse,
} from '@simra/preference-avoidance-common';
import { PreferenceAvoidanceAnalysisFacade } from '@simra/preference-avoidance-domain';
import { circle } from '@turf/turf';
import { LineString, MultiLineString, Point, Polygon } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import { Protocol } from 'pmtiles';
import { firstValueFrom } from 'rxjs';
import { Card } from 'primeng/card';
import { Checkbox } from 'primeng/checkbox';
import { Skeleton } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { SortEvent } from 'primeng/api';

const preferenceAvoidanceSegmentsSource = 'preference-avoidance-segments-source';
const preferenceAvoidanceStreetsLayer = 'preference-avoidance-streets-layer';
const preferenceAvoidanceSegmentsLayer = 'preference-avoidance-segments-layer';
const preferenceAvoidanceMatchedSource = 'preference-avoidance-matched-source';
const preferenceAvoidanceMatchedLayer = 'preference-avoidance-matched-layer';
const preferenceAvoidanceHighlightSource = 'preference-avoidance-segments-highlight-source';
const preferenceAvoidanceHighlightOutlineLayer = 'preference-avoidance-segments-highlight-outline-layer';
const preferenceAvoidanceHighlightLayer = 'preference-avoidance-segments-highlight-layer';
const trafficDetectorsSource = 'preference-avoidance-traffic-detectors-source';
const trafficDetectorsLayer = 'preference-avoidance-traffic-detectors-layer';
const trafficDetectorRadiusSource = 'preference-avoidance-traffic-detector-radius-source';
const trafficDetectorRadiusFillLayer = 'preference-avoidance-traffic-detector-radius-fill-layer';
const trafficDetectorRadiusLineLayer = 'preference-avoidance-traffic-detector-radius-line-layer';
const trafficDetectorActiveColor = '#d97706';
const trafficDetectorInactiveColor = '#9ca3af';
const berlinMapCenter: [number, number] = [13.413, 52.522];
const berlinMapZoom = 14;
// below this zoom the tileset only contains the aggregated 'streets' layer
const segmentDetailMinZoom = 12;
const segmentLayerTransitionZoom = 1;
const mapMinSampleSize = 10;
const minSelectableEventYear = 2015;	// avoide test/noise rides

let pmtilesProtocolRegistered = false;
function registerPmtilesProtocol(): void {
	if (pmtilesProtocolRegistered) {
		return;
	}
	const protocol = new Protocol();
	maplibregl.addProtocol('pmtiles', (params, abortController) => protocol.tile(params, abortController));
	pmtilesProtocolRegistered = true;
}

type EventFilter = 'ALL' | SegmentEventType;
type PanelViewMode = 'INFO' | 'EVENTS';
type MapBaseStyle = 'MAP' | 'SATELLITE';

/**
 * Map/Satellite switch rendered as a native MapLibre control so it sits on the
 * map alongside zoom/fullscreen instead of in the card header.
 */
class MapBaseStyleControl implements maplibregl.IControl {
	private container?: HTMLElement;
	private readonly buttons = new Map<MapBaseStyle, HTMLButtonElement>();

	constructor(
		private readonly options: { label: string; value: MapBaseStyle }[],
		private readonly getSelected: () => MapBaseStyle,
		private readonly onSelect: (value: MapBaseStyle) => void,
	) {}

	onAdd(): HTMLElement {
		const container = document.createElement('div');
		container.className = 'maplibregl-ctrl maplibregl-ctrl-group pa-map-style-control';
		for (const option of this.options) {
			const button = document.createElement('button');
			button.type = 'button';
			button.textContent = option.label;
			button.addEventListener('click', () => {
				this.onSelect(option.value);
				this.refresh();
			});
			this.buttons.set(option.value, button);
			container.appendChild(button);
		}
		this.container = container;
		this.refresh();
		return container;
	}

	onRemove(): void {
		this.container?.remove();
		this.buttons.clear();
	}

	private refresh(): void {
		const selected = this.getSelected();
		for (const [value, button] of this.buttons) {
			button.classList.toggle('pa-map-style-control__button--active', selected === value);
			button.setAttribute('aria-pressed', String(selected === value));
		}
	}
}
type RiskLegendBucket =
	'PREFERENCE_STRONG'
	| 'PREFERENCE'
	| 'PREFERENCE_LIGHT'
	| 'BASELINE'
	| 'AVOIDANCE_LIGHT'
	| 'AVOIDANCE'
	| 'AVOIDANCE_STRONG'
	| 'NO_EVENTS';

interface RiskLegendItem {
	bucket: Exclude<RiskLegendBucket, 'NO_EVENTS'>;
	label: string;
	classModifier: string;
}

const riskLegendItems: RiskLegendItem[] = [
	{ bucket: 'PREFERENCE_STRONG', label: 'Strongly preferred segments', classModifier: 'preference-strong' },
	{ bucket: 'PREFERENCE', label: 'Preferred segments', classModifier: 'preference' },
	{ bucket: 'PREFERENCE_LIGHT', label: 'Slightly preferred segments', classModifier: 'preference-light' },
	{ bucket: 'BASELINE', label: 'Balanced segments', classModifier: 'baseline' },
	{ bucket: 'AVOIDANCE_LIGHT', label: 'Slightly avoided segments', classModifier: 'avoidance-light' },
	{ bucket: 'AVOIDANCE', label: 'Avoided segments', classModifier: 'avoidance' },
	{ bucket: 'AVOIDANCE_STRONG', label: 'Strongly avoided segments', classModifier: 'avoidance-strong' },
];

const riskLegendColors: Record<RiskLegendBucket, string> = {
	PREFERENCE_STRONG: '#166534',
	PREFERENCE: '#16a34a',
	PREFERENCE_LIGHT: '#86efac',
	BASELINE: '#6b7280',
	AVOIDANCE_LIGHT: '#fca5a5',
	AVOIDANCE: '#dc2626',
	AVOIDANCE_STRONG: '#991b1b',
	NO_EVENTS: '#d1d5db',
};

// map to the per-segment enrichment event counts baked into the tile properties
const enrichmentFilterCountProperty: Record<SegmentEnrichmentFilter, keyof SegmentTileProperties> = {
	TRAFFIC_ENRICHED: 'trafficEnrichedEventCount',
	WEATHER_ENRICHED: 'weatherEnrichedEventCount',
	OHSOME_ENRICHED: 'ohsomeEnrichedEventCount',
	TRAFFIC_MEASURED: 'trafficMeasuredEventCount',
};

// the tiles carry all-time properties (bucket/eventCount) plus per-year variants
// (bucket_<year>/eventCount_<year>), so year views restyle the same tile layers
function bucketColorExpression(bucketProperty: string): maplibregl.ExpressionSpecification {
	return [
		'match',
		['get', bucketProperty],
		'PREFERENCE_STRONG', riskLegendColors.PREFERENCE_STRONG,
		'PREFERENCE', riskLegendColors.PREFERENCE,
		'PREFERENCE_LIGHT', riskLegendColors.PREFERENCE_LIGHT,
		'BASELINE', riskLegendColors.BASELINE,
		'AVOIDANCE_LIGHT', riskLegendColors.AVOIDANCE_LIGHT,
		'AVOIDANCE', riskLegendColors.AVOIDANCE,
		'AVOIDANCE_STRONG', riskLegendColors.AVOIDANCE_STRONG,
		riskLegendColors.NO_EVENTS,
	];
}

// replicates eventLineWidth(): min(8, max(1.5, 1.5 + log10(events + 1) * 2.2))
function eventLineWidthExpression(countProperty: string): maplibregl.ExpressionSpecification {
	return [
		'min', 8,
		['max', 1.5, ['+', 1.5, ['*', 2.2, ['log10', ['+', ['coalesce', ['get', countProperty], 0], 1]]]]],
	];
}

const segmentLinePaint: maplibregl.LineLayerSpecification['paint'] = {
	'line-color': bucketColorExpression('bucket'),
	'line-width': eventLineWidthExpression('eventCount'),
	'line-opacity': 0.88,
};

type HighlightableSegment = Pick<
	SegmentSummary,
	'avoidanceCount' | 'preferenceCount' | 'avoidanceRatio' | 'preferenceRatio'
>;

interface ContextHighlight {
	label: string;
	value: string;
	count: number;
}

interface DetailMetric {
	label: string;
	value: string;
	detail?: string;
}

interface EventChip {
	label: string;
	value: string;
	tone: 'infrastructure' | 'traffic' | 'weather' | 'wind';
}

interface EventDetailItem {
	label: string;
	value: string;
	infoId?: string;
	infoUrl?: string;
}

interface EventDetailGroup {
	label: 'Ride' | 'Weather' | 'Cycling infrastructure' | 'Traffic';
	items: EventDetailItem[];
}

type IconTone = 'blue' | 'green' | 'purple' | 'orange';

/** One expandable row of the "Ride conditions" card inside an event card. */
interface ConditionRow {
	label: 'Weather' | 'Infrastructure' | 'Traffic';
	icon: string;
	tone: IconTone;
	summary: string;
	compact?: string;
	items: EventDetailItem[];
}

interface EventQualificationCriteria {
	enrichmentFilters: SegmentEnrichmentFilter[];
	year?: number;
	rideIntent?: string;
	trafficCondition?: string;
}

interface SegmentQualificationParams extends EventQualificationCriteria {
	segmentIds: number[];
}

interface SummaryCard {
	label: string;
	value: number;
	icon: string;
	tone: IconTone;
	enrichmentFilter?: SegmentEnrichmentFilter;
}

@Component({
	selector: 't-preference-avoidance-page',
	standalone: true,
	imports: [
		FormsModule,
		MapPage,
		Card,
		Checkbox,
		Skeleton,
		TableModule,
		DecimalPipe,
	],
	templateUrl: './preference-avoidance.page.html',
	styleUrl: './preference-avoidance.page.scss',
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 't-preference-avoidance-page',
	},
})
export class PreferenceAvoidancePage {
	private readonly _facade = inject(PreferenceAvoidanceAnalysisFacade);
	private readonly _appConfig = inject(APP_CONFIG);
	private readonly _mapTilerToken = this._appConfig.mapTilerToken;
	private readonly _map = signal<maplibregl.Map | undefined>(undefined);
	private readonly _selectedSegmentTileProperties = signal<SegmentTileProperties | undefined>(undefined);
	private readonly _segmentDetailCache = new Map<number, SegmentSummary>();
	private readonly _addressCache = new Map<number, string | undefined>();
	private _mapHandlersRegistered = false;
	private _selectedHighlightFeature?: GeoJSON.Feature<LineString | MultiLineString>;
	private _hoverHighlightFeature?: GeoJSON.Feature<LineString | MultiLineString>;
	private _matchedOverlayFeatures: GeoJSON.Feature<LineString>[] = [];
	private _trafficDetectorFeatures: GeoJSON.Feature<Point>[] = [];
	private _trafficDetectorRadiusFeature?: GeoJSON.Feature<Polygon>;
	private _trafficDetectorPopup?: maplibregl.Popup;

	protected readonly selectedMapBaseStyle = signal<MapBaseStyle>('MAP');
	protected readonly showTrafficSensors = signal(false);
	protected readonly showSegmentEvents = signal(true);
	protected readonly selectedDetectorKey = signal<string | undefined>(undefined);
	protected readonly expandedConditionGroup = signal<string | undefined>(undefined);
	protected readonly showTechnicalDetails = signal(false);
	protected readonly selectedSegmentId = signal<number | undefined>(undefined);
	protected readonly selectedEventId = signal<string | undefined>(undefined);
	protected readonly selectedInfoPopoverId = signal<string | undefined>(undefined);
	protected readonly hoveredSegmentId = signal<number | undefined>(undefined);
	protected readonly selectedEventFilter = signal<EventFilter>('ALL');
	protected readonly selectedPanelView = signal<PanelViewMode>('INFO');
	protected readonly selectedRiskLegendBuckets = signal<RiskLegendItem['bucket'][]>([]);
	protected readonly selectedEnrichmentFilters = signal<SegmentEnrichmentFilter[]>([]);
	// undefined = "All time"
	protected readonly selectedYear = signal<number | undefined>(undefined);
	protected readonly minIncidents = signal<number | null>(null);
	protected readonly selectedRideIntent = signal<string | undefined>(undefined);
	protected readonly selectedTrafficCondition = signal<string | undefined>(undefined);
	protected readonly segmentSortField = signal<string>('avoidanceCount');
	protected readonly segmentSortOrder = signal<1 | -1>(-1);
	protected readonly riskLegendItems = riskLegendItems;
	protected readonly eventFilterOptions: { label: string; value: EventFilter }[] = [
		{ label: 'All events', value: 'ALL' },
		{ label: 'Avoidance', value: 'AVOIDANCE' },
		{ label: 'Preference', value: 'PREFERENCE' },
	];
	protected readonly panelViewOptions: { label: string; value: PanelViewMode }[] = [
		{ label: 'General', value: 'INFO' },
		{ label: 'Events', value: 'EVENTS' },
	];
	protected readonly mapBaseStyleOptions: { label: string; value: MapBaseStyle }[] = [
		{ label: 'Map', value: 'MAP' },
		{ label: 'Satellite', value: 'SATELLITE' },
	];

	protected readonly summaryStats = resource({
		loader: async () => firstValueFrom(this._facade.getSummary()),
	});

	protected readonly segmentPool = resource<SegmentSummary[], string>({
		params: () => `${this.segmentPoolLimit()}|${[...this.selectedEnrichmentFilters()].sort().join(',')}|${this.selectedYear() ?? ''}`,
		defaultValue: [],
		loader: async ({ params }) => {
			const [limit, filters, year] = params.split('|');
			return firstValueFrom(this._facade.getSegments({
				minAvoidanceRatio: 0,
				minSampleSize: 1,
				limit: Number(limit),
				...this.yearRange(year ? Number(year) : undefined),
				enrichmentFilters: this.enrichmentFiltersParam(
					filters ? filters.split(',') as SegmentEnrichmentFilter[] : [],
				),
			}));
		},
	});

	protected readonly tileStatus = resource<TileStatus | undefined, unknown>({
		loader: async () => firstValueFrom(this._facade.getTileStatus()).catch(() => undefined),
	});

	protected readonly trafficDetectors = resource<TrafficDetectorsResponse | undefined, boolean | undefined>({
		params: () => this.showTrafficSensors() || undefined,
		loader: async () => firstValueFrom(this._facade.getTrafficDetectors()).catch(() => undefined),
	});

	private readonly trafficDetectorFeatures = computed<GeoJSON.Feature<Point>[]>(() => {
		const response = this.trafficDetectors.value();
		if (!response) {
			return [];
		}

		const locations = new Map<string, TrafficDetector[]>();
		for (const detector of response.detectors) {
			const key = `${detector.lon}|${detector.lat}`;
			const group = locations.get(key);
			if (group) {
				group.push(detector);
			} else {
				locations.set(key, [detector]);
			}
		}

		return [...locations.entries()].map(([key, detectors]) => {
			const activeDetectors = detectors.filter((detector) => !detector.deinstalled);
			const sample = detectors[0];
			return {
				type: 'Feature' as const,
				geometry: { type: 'Point' as const, coordinates: [sample.lon, sample.lat] },
				properties: {
					key,
					street: sample.street ?? '',
					position: sample.position ?? '',
					positionDetail: sample.positionDetail ?? '',
					directions: [...new Set(detectors.map((detector) => detector.direction).filter(Boolean))].join(' · '),
					detectorNames: detectors.map((detector) => detector.detName).join(', '),
					laneCount: detectors.length,
					activeLaneCount: activeDetectors.length,
					active: activeDetectors.length > 0,
					activeFrom: sample.activeFrom ?? '',
					activeTo: sample.activeTo ?? '',
				},
			};
		});
	});

	protected readonly selectedSegmentDetails = resource<SegmentSummary | undefined, number | undefined>({
		params: () => this.selectedSegmentId(),
		loader: async ({ params }) => this.resolveSegmentSummary(params),
	});

	protected readonly selectedSegmentAddress = resource<string | undefined, {
		segmentId: number;
		lon: number;
		lat: number;
	} | undefined>({
		params: () => {
			const segment = this.selectedSegment();
			const coordinates = segment?.geometry?.coordinates;
			if (!segment || !coordinates?.length) {
				return undefined;
			}

			const [lon, lat] = coordinates[Math.floor(coordinates.length / 2)] as [number, number];
			return { segmentId: segment.id, lon, lat };
		},
		loader: async ({ params }) => this.reverseGeocode(params.segmentId, params.lon, params.lat),
	});

	protected readonly selectedSegmentEvents = resource<SegmentEvent[], {
		segmentId: number;
		eventFilter: EventFilter;
		year?: number;
	} | undefined>({
		params: () => {
			const segmentId = this.selectedSegmentId();
			if (!segmentId) {
				return undefined;
			}

			return {
				segmentId,
				eventFilter: this.selectedEventFilter(),
				year: this.selectedYear(),
			};
		},
		defaultValue: [],
		loader: async ({ params }) => {
			return firstValueFrom(this._facade.getSegmentEvents(params.segmentId, {
				eventType: params.eventFilter === 'ALL' ? undefined : params.eventFilter,
				...this.yearRange(params.year),
				limit: 1000,
			}));
		},
	});

	protected readonly filteredSelectedSegmentEvents = computed(() => {
		const events = this.selectedSegmentEvents.value() ?? [];
		const criteria: EventQualificationCriteria = {
			enrichmentFilters: this.selectedEnrichmentFilters(),
			rideIntent: this.selectedRideIntent(),
			trafficCondition: this.selectedTrafficCondition(),
		};
		return events.filter((event) => this.eventMatchesQualificationCriteria(event, criteria));
	});

	protected readonly qualifiedSegmentIds = resource<Set<number>, SegmentQualificationParams | undefined>({
		params: () => {
			const criteria: EventQualificationCriteria = {
				enrichmentFilters: this.selectedEnrichmentFilters(),
				year: this.selectedYear(),
				rideIntent: this.selectedRideIntent(),
				trafficCondition: this.selectedTrafficCondition(),
			};
			if (!this.eventQualificationActive()) {
				return undefined;
			}

			const listSegmentIds = (this.segmentPool.value() ?? [])
				.filter((segment) => this.segmentMatchesPropertyFilters(segment))
				.map((segment) => segment.id);

			return {
				segmentIds: [...new Set(listSegmentIds)],
				...criteria,
			};
		},
		defaultValue: new Set<number>(),
		loader: async ({ params }) => {
			if (!params?.segmentIds.length) {
				return new Set<number>();
			}

			return this.loadQualifiedSegmentIds(params.segmentIds, params);
		},
	});

	private readonly normalizedMinIncidents = computed<number | null>(() => {
		const value = this.minIncidents();
		return typeof value === 'number' && value > 0 ? value : null;
	});

	private readonly segmentPoolLimit = computed<number>(() => {
		if (this.normalizedMinIncidents() !== null) {
			return 5000;
		}
		return this.eventQualificationActive() || this.selectedYear() !== undefined ? 250 : 50;
	});

	protected readonly eventQualificationActive = computed(() => {
		return this.selectedRideIntent() !== undefined
			|| this.selectedTrafficCondition() !== undefined;
	});

	protected readonly matchedOverlayActive = computed(() => {
		return this.selectedRideIntent() !== undefined
			|| this.selectedTrafficCondition() !== undefined
			|| this.normalizedMinIncidents() !== null;
	});

	protected readonly hasPropertyFilters = computed(() => {
		return this.normalizedMinIncidents() !== null
			|| this.selectedRideIntent() !== undefined
			|| this.selectedTrafficCondition() !== undefined;
	});

	protected readonly rideIntentOptions = resource<string[], unknown>({
		defaultValue: [],
		loader: async () => {
			const buckets = await firstValueFrom(this._facade.getDistribution({ dimension: 'RIDE_INTENT' }));
			return buckets.map((bucket) => bucket.value);
		},
	});

	protected readonly trafficConditionOptions = resource<string[], unknown>({
		defaultValue: [],
		loader: async () => {
			const buckets = await firstValueFrom(this._facade.getDistribution({ dimension: 'TRAFFIC_CONDITION' }));
			return buckets.map((bucket) => bucket.value).filter((value) => value !== 'UNKNOWN');
		},
	});

	protected readonly matchedOverlayCollection = resource<SegmentsGeoJson | undefined, string | undefined>({
		params: () => {
			if (!this.matchedOverlayActive()) {
				return undefined;
			}
			return `${this.selectedYear() ?? ''}|${[...this.selectedEnrichmentFilters()].sort().join(',')}`;
		},
		loader: async ({ params }) => {
			const [year, filters] = params.split('|');
			return firstValueFrom(this._facade.getSegmentsGeoJson({
				minAvoidanceRatio: 0,
				minPreferenceRatio: 0,
				minSampleSize: 1,
				limit: 10000,
				...this.yearRange(year ? Number(year) : undefined),
				enrichmentFilters: this.enrichmentFiltersParam(
					filters ? filters.split(',') as SegmentEnrichmentFilter[] : [],
				),
			}));
		},
	});

	private readonly matchedOverlayFeatures = computed<GeoJSON.Feature<LineString>[]>(() => {
		const collection = this.matchedOverlayCollection.value();
		if (!this.matchedOverlayActive() || !collection) {
			return [];
		}

		const allowedIds = this.eventQualificationActive() || this.hasPropertyFilters()
			? new Set(this.sortedSegments().map((segment) => segment.id))
			: undefined;
		return collection.features
			.filter((feature) => !allowedIds || allowedIds.has(feature.properties.id))
			.map((feature): GeoJSON.Feature<LineString> => ({
				type: 'Feature',
				geometry: feature.geometry,
				properties: {
					id: feature.properties.id,
					avoidanceCount: feature.properties.avoidanceCount,
					preferenceCount: feature.properties.preferenceCount,
					bucket: this.eventSignalBucket(feature.properties),
					color: this.eventSignalColor(feature.properties),
					width: this.eventLineWidth(feature.properties),
				},
			}));
	});

	protected readonly sortedSegments = computed(() => {
		const qualificationActive = this.eventQualificationActive();
		const qualifiedIds = this.qualifiedSegmentIds.value();
		const segments = (this.segmentPool.value() ?? []).filter((segment) => {
			if (qualificationActive && !qualifiedIds.has(segment.id)) {
				return false;
			}
			return this.segmentMatchesPropertyFilters(segment);
		});
		const field = this.segmentSortField();
		const order = this.segmentSortOrder();
		return [...segments].sort((a, b) => {
			const aVal = (a as unknown as Record<string, unknown>)[field] ?? 0;
			const bVal = (b as unknown as Record<string, unknown>)[field] ?? 0;
			if (typeof aVal === 'number' && typeof bVal === 'number') {
				return (aVal - bVal) * order;
			}
			return String(aVal).localeCompare(String(bVal)) * order;
		});
	});

	protected readonly summaryCards = computed<SummaryCard[]>(() => {
		const summary = this.summaryStats.value();
		if (!summary) {
			return [];
		}

		return [
			{ label: 'Total rides', value: summary.totalRides, icon: 'ph-bicycle', tone: 'blue' as const },
			{
				label: 'Processed rides',
				value: summary.rideStatusCounts?.['PROCESSED'] ?? 0,
				icon: 'ph-check-circle',
				tone: 'green' as const,
			},
			{ label: 'Segment events', value: summary.totalSegmentEvents, icon: 'ph-path', tone: 'purple' as const },
			{ label: 'Observed segments', value: summary.observedSegments, icon: 'ph-road-horizon', tone: 'blue' as const },
			{
				label: 'Weather enriched',
				value: summary.weatherEnrichedEvents,
				icon: 'ph-cloud-rain',
				tone: 'blue' as const,
				enrichmentFilter: 'WEATHER_ENRICHED' as const,
			},
			{
				label: 'Historical OSM data enriched',
				value: summary.ohsomeEnrichedEvents,
				icon: 'ph-map-trifold',
				tone: 'green' as const,
				enrichmentFilter: 'OHSOME_ENRICHED' as const,
			},
			{
				label: 'Traffic measured',
				value: summary.trafficMeasuredEvents,
				icon: 'ph-traffic-signal',
				tone: 'orange' as const,
				enrichmentFilter: 'TRAFFIC_MEASURED' as const,
			},
		];
	});

	protected readonly yearOptions = computed<number[]>(() => {
		const summary = this.summaryStats.value();
		if (!summary?.latestEventTimestamp) {
			return [];
		}

		const earliestYear = Math.max(
			minSelectableEventYear,
			summary.earliestEventTimestamp ? new Date(summary.earliestEventTimestamp).getUTCFullYear() : minSelectableEventYear,
		);
		const latestYear = new Date(summary.latestEventTimestamp).getUTCFullYear();
		const years: number[] = [];
		for (let year = latestYear; year >= earliestYear; year--) {
			years.push(year);
		}
		return years;
	});

	protected readonly selectedSegment = computed<SegmentSummary | undefined>(() => {
		const segmentId = this.selectedSegmentId();
		const segmentDetails = this.selectedSegmentDetails.value();
		if (segmentDetails) {
			return segmentDetails;
		}

		const segments = this.segmentPool.value() ?? [];
		return segments.find((currentSegment) => currentSegment.id === segmentId);
	});

	protected readonly inspectorSubtitle = computed<string | undefined>(() => {
		const segment = this.selectedSegment();
		if (!segment) {
			return undefined;
		}

		const street = segment.streetName || 'Unknown street';
		const address = this.selectedSegmentAddress.value();
		return `${street}${address ? `, ${address}` : ''} · ${segment.id}`;
	});

	protected readonly segmentInfoMetrics = computed<DetailMetric[]>(() => {
		const segment = this.selectedSegment();
		if (!segment) {
			return [];
		}

		return [
			{ label: 'Street', value: this.formatPlainValue(segment.streetName || 'Unknown street') },
			{ label: 'Segment id', value: String(segment.id) },
			{ label: 'Avoidance events', value: this.formatNumber(segment.avoidanceCount) },
			{ label: 'Preference events', value: this.formatNumber(segment.preferenceCount) },
			{ label: 'Observations', value: this.formatNumber(segment.totalObservationCount) },
			{ label: 'Avoidance ratio', value: this.formatPercent(segment.avoidanceRatio) },
			{ label: 'Preference ratio', value: this.formatPercent(segment.preferenceRatio) },
			{
				label: 'Gradient',
				value: segment?.gradientPercent === null || segment?.gradientPercent === undefined
					? '-'
					: `${segment.gradientPercent.toFixed(1)}%`,
			},
			{
				label: 'Traffic',
				value: this.formatTraffic(segment),
				detail: `${segment?.traffic?.trafficMeasuredEventCount ?? 0} measured events`,
			},
			{
				label: 'Incidents nearby',
				value: this.formatValue(segment?.incidentCount ?? 0),
				detail: this.formatIncidentBreakdown(segment),
			},
			{
				label: 'External factors',
				value: this.formatValue(segment?.externalFactors?.length ?? 0),
				detail: this.formatExternalFactors(segment),
			},
		].filter((metric) => metric.value !== '-');
	});

	protected readonly infrastructureHighlights = computed<ContextHighlight[]>(() => {
		const events = this.filteredSelectedSegmentEvents();
		return [
			this.topContext(events, 'highway', 'Highway'),
			this.topContext(events, 'cyclewayType', 'Cycleway type'),
			this.topContext(events, 'cyclewayLocation', 'Cycleway location'),
			this.topContext(events, 'cyclewaySurface', 'Cycleway surface'),
			this.topContext(events, 'surface', 'Surface'),
			this.topContext(events, 'smoothness', 'Smoothness'),
			this.topContext(events, 'lit', 'Lighting'),
			this.topContext(events, 'bicycleOneway', 'Bicycle oneway'),
		].filter((item): item is ContextHighlight => item !== undefined);
	});

	constructor() {
		registerPmtilesProtocol();

		effect(() => {
			const map = this._map();
			const generatedAt = this.tileStatus.value()?.generatedAt;
			if (!map || !generatedAt) {
				return;
			}

			this.ensureMapLayers(map, generatedAt);
		});

		effect(() => {
			const map = this._map();
			this.selectedRiskLegendBuckets();
			this.selectedEnrichmentFilters();
			this.selectedYear();
			this.matchedOverlayActive();
			this.showSegmentEvents();
			if (!map) {
				return;
			}

			this.applyMapFilters(map);
		});

		// keep the matched-segments overlay in sync with the active filters
		effect(() => {
			const map = this._map();
			this._matchedOverlayFeatures = this.matchedOverlayFeatures();
			if (map) {
				this.syncMatchedSource(map);
			}
		});

		effect(() => {
			const selectedId = this.selectedSegmentId();
			const filters = this.selectedEnrichmentFilters();
			const segmentFilteringActive = this.eventQualificationActive()
				|| this.selectedYear() !== undefined
				|| filters.length > 0;
			if (!selectedId || !segmentFilteringActive
				|| this.qualifiedSegmentIds.isLoading() || this.segmentPool.isLoading()) {
				return;
			}

			const tileProperties = this._selectedSegmentTileProperties();
			const selectedSegmentVisible = this.sortedSegments().some((segment) => segment.id === selectedId)
				|| this.matchedOverlayFeatures().some((feature) => feature.properties?.['id'] === selectedId)
				|| (!this.matchedOverlayActive()
					&& tileProperties !== undefined
					&& this.tilePropertiesMatchFilters(tileProperties, filters, this.selectedYear()));
			if (!selectedSegmentVisible) {
				this.selectSegment(undefined);
			}
		});

		effect(() => {
			const map = this._map();
			this._trafficDetectorFeatures = this.showTrafficSensors() ? this.trafficDetectorFeatures() : [];
			if (map) {
				this.syncTrafficDetectorSource(map);
			}
		});

		effect(() => {
			const hoveredId = this.hoveredSegmentId();
			const selectedId = this.selectedSegmentId();
			const map = this._map();
			if (!map) {
				return;
			}

			if (hoveredId && hoveredId !== selectedId) {
				void this.applyHoverHighlight(map, hoveredId, () =>
					this.hoveredSegmentId() === hoveredId && this.selectedSegmentId() !== hoveredId);
			} else {
				this.clearHoverHighlight(map);
			}
		});

		effect(() => {
			const selectedId = this.selectedSegmentId();
			const map = this._map();
			if (map && !selectedId) {
				this.clearSelectedHighlight(map);
			}
		});

		effect(() => {
			const details = this.selectedSegmentDetails.value();
			const map = this._map();
			if (!details?.geometry) {
				return;
			}

			if (map && this.selectedSegmentId() === details.id) {
				this.setSelectedHighlight(map, details.geometry, details);
			}
		});
	}

	protected onMapReady(map: maplibregl.Map): void {
		map.jumpTo({ center: berlinMapCenter, zoom: berlinMapZoom });
		map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right');
		map.addControl(new maplibregl.FullscreenControl(), 'top-right');
		map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
		map.addControl(new MapBaseStyleControl(
			this.mapBaseStyleOptions,
			() => this.selectedMapBaseStyle(),
			(style) => this.onMapBaseStyleChange(style),
		), 'top-left');
		this._map.set(map);
	}

	protected onSegmentEventsToggle(visible: boolean): void {
		this.showSegmentEvents.set(visible);
	}

	protected onClearAllFilters(): void {
		this.onPropertyFiltersClear();
		this.onEnrichmentFiltersClear();
		this.onRiskLegendClear();
	}

	protected onResetMapView(): void {
		this._map()?.jumpTo({ center: berlinMapCenter, zoom: berlinMapZoom });
	}

	protected onConditionRowToggle(label: string): void {
		this.expandedConditionGroup.update((expanded) => expanded === label ? undefined : label);
	}

	protected onTechnicalDetailsToggle(): void {
		this.showTechnicalDetails.update((shown) => !shown);
	}

	protected onSegmentRowHover(segmentId: number): void {
		this.hoveredSegmentId.set(segmentId);
	}

	protected onSegmentRowLeave(): void {
		this.hoveredSegmentId.set(undefined);
	}

	protected onSegmentSort(event: SortEvent): void {
		if (event.field) {
			this.segmentSortField.set(event.field);
		}
		this.segmentSortOrder.set((event.order ?? -1) as 1 | -1);
	}

	protected async flyToSegment(segmentId: number): Promise<void> {
		this.selectSegment(segmentId);
		const map = this._map();
		if (!map) {
			return;
		}

		const segment = await this.resolveSegmentSummary(segmentId);
		if (!segment?.geometry || this.selectedSegmentId() !== segmentId) {
			return;
		}

		const coordinates = segment.geometry.coordinates;
		const bounds = coordinates.reduce((currentBounds, coordinate) => {
			return currentBounds.extend(coordinate as [number, number]);
		}, new maplibregl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number]));

		map.fitBounds(bounds, { padding: 80, maxZoom: 16, duration: 800 });

		this.setSelectedHighlight(map, segment.geometry, segment);
	}

	protected onYearChange(year: number | undefined): void {
		this.selectedYear.set(year);
	}

	protected onPropertyFiltersClear(): void {
		this.minIncidents.set(null);
		this.selectedRideIntent.set(undefined);
		this.selectedTrafficCondition.set(undefined);
	}

	protected onEventFilterChange(value: string): void {
		this.selectedEventId.set(undefined);
		this.selectedInfoPopoverId.set(undefined);
		this.selectedEventFilter.set(value as EventFilter);
	}

	protected onSummaryCardClick(card: SummaryCard): void {
		if (!card.enrichmentFilter) {
			return;
		}

		this.selectedEnrichmentFilters.update((selectedFilters) => {
			const filter = card.enrichmentFilter as SegmentEnrichmentFilter;
			if (selectedFilters.includes(filter)) {
				return selectedFilters.filter((selectedFilter) => selectedFilter !== filter);
			}

			return [...selectedFilters, filter];
		});
		this.selectSegment(undefined);
		const map = this._map();
		if (map) {
			this.clearHighlight(map);
		}
	}

	protected isSummaryCardSelected(card: SummaryCard): boolean {
		return card.enrichmentFilter !== undefined && this.selectedEnrichmentFilters().includes(card.enrichmentFilter);
	}

	protected isSummaryCardClickable(card: SummaryCard): boolean {
		return card.enrichmentFilter !== undefined;
	}

	protected onEnrichmentFiltersClear(): void {
		this.selectedEnrichmentFilters.set([]);
		this.selectSegment(undefined);
		const map = this._map();
		if (map) {
			this.clearHighlight(map);
		}
	}

	protected onRiskLegendToggle(bucket: RiskLegendItem['bucket']): void {
		this.selectedRiskLegendBuckets.update((selectedBuckets) => {
			if (selectedBuckets.includes(bucket)) {
				return selectedBuckets.filter((selectedBucket) => selectedBucket !== bucket);
			}

			return [...selectedBuckets, bucket];
		});
	}

	protected onRiskLegendClear(): void {
		this.selectedRiskLegendBuckets.set([]);
	}

	protected isRiskLegendSelected(bucket: RiskLegendItem['bucket']): boolean {
		return this.selectedRiskLegendBuckets().includes(bucket);
	}

	protected onPanelViewChange(value: PanelViewMode): void {
		this.selectedPanelView.set(value);
	}

	protected onMapBaseStyleChange(value: MapBaseStyle): void {
		if (this.selectedMapBaseStyle() === value) {
			return;
		}

		this.selectedMapBaseStyle.set(value);
		const map = this._map();
		if (!map) {
			return;
		}

		map.setStyle(this.mapBaseStyleUrl(value));
		map.once('styledata', () => {
			if (map.isStyleLoaded()) {
				this.renderCurrentMapState(map);
				return;
			}

			map.once('idle', () => this.renderCurrentMapState(map));
		});
	}

	protected onEventCardClick(eventId: string): void {
		this.selectedInfoPopoverId.set(undefined);
		this.expandedConditionGroup.set(undefined);
		this.showTechnicalDetails.set(false);
		this.selectedEventId.update((selectedEventId) => selectedEventId === eventId ? undefined : eventId);
	}

	protected onEventCardContainerClick(mouseEvent: MouseEvent, eventId: string): void {
		const target = mouseEvent.target as HTMLElement;
		if (target.closest('.event-card__button') || target.closest('.event-detail')) {
			return;
		}
		this.onEventCardClick(eventId);
	}

	protected onInfoPopoverToggle(event: MouseEvent, infoId: string): void {
		event.stopPropagation();
		this.selectedInfoPopoverId.update((selectedInfoId) => selectedInfoId === infoId ? undefined : infoId);
	}

	protected formatPercent(value?: number): string {
		if (value === null || value === undefined) {
			return '-';
		}
		return `${(value * 100).toFixed(1)}%`;
	}

	protected formatDateTime(timestamp?: number): string {
		if (!timestamp) {
			return '-';
		}
		return new Intl.DateTimeFormat('en', {
			year: 'numeric',
			month: 'short',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		}).format(new Date(timestamp));
	}

	protected formatValue(value: unknown): string {
		if (value === null || value === undefined || value === '') {
			return '-';
		}
		if (typeof value === 'number') {
			return value.toLocaleString('en', { maximumFractionDigits: 1 });
		}
		return this.formatBucketValue(String(value));
	}

	protected formatDirection(degrees?: number): string | undefined {
		if (degrees === null || degrees === undefined) {
			return undefined;
		}

		const normalizedDegrees = ((degrees % 360) + 360) % 360;
		const cardinalDirections = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
		const cardinalIndex = Math.round(normalizedDegrees / 45) % cardinalDirections.length;
		return cardinalDirections[cardinalIndex];
	}

	protected eventPreviewChips(event: SegmentEvent): EventChip[] {
		const temperatureChip = this.eventChip('Temp', event.temperature2m, 'weather', '°C');
		const chips = [
			this.eventChip('Cycleway', event.cyclewayType, 'infrastructure'),
			this.eventChip('Highway', event.highway, 'infrastructure'),
			this.eventChip('Surface', event.surface, 'infrastructure'),
			this.eventChip('Traffic', event.trafficCondition, 'traffic'),
			this.eventChip('Volume', event.trafficVolumeKfz, 'traffic', ' vehicles'),
			this.eventChip('Wind', event.windExposure, 'wind'),
			temperatureChip,
			this.eventChip('Wind speed', event.windSpeed10m, 'wind', ' km/h'),
		].filter((chip): chip is EventChip => chip !== undefined);

		const preview = chips.slice(0, 4);
		if (temperatureChip && !preview.includes(temperatureChip)) {
			preview[preview.length - 1] = temperatureChip;
		}
		return preview;
	}

	protected rideDetailItems(event: SegmentEvent): EventDetailItem[] {
		return this.eventDetailGroup('Ride', [
			this.eventDetailItem('Intent', event.rideIntent),
			this.eventDetailItem('Bike type', event.bikeType),
			this.eventDetailItem('Ride id', event.rideId, { formatBucket: false }),
		]).items;
	}

	protected eventConditionRows(event: SegmentEvent): ConditionRow[] {
		const rows: (ConditionRow | undefined)[] = [
			event.weatherEnriched ? {
				label: 'Weather',
				icon: 'ph-cloud-rain',
				tone: 'blue',
				summary: (event.weatherCode !== null && event.weatherCode !== undefined
					? this.weatherCodeDescription(event.weatherCode)
					: undefined) ?? 'Conditions recorded',
				compact: this.eventWeatherSummary(event),
				items: this.eventDetailGroup('Weather', [
					this.eventDetailItem('Temperature', event.temperature2m, { suffix: '°C' }),
					this.eventDetailItem('Precipitation', event.precipitation, { suffix: ' mm' }),
					this.eventDetailItem('Wind exposure', event.windExposure),
					this.eventDetailItem('Wind speed', event.windSpeed10m, { suffix: ' km/h' }),
					this.eventDetailItem('Weather code', this.formatWeatherCode(event.weatherCode), {
						formatBucket: false,
						infoId: `${event.id}-weather-code`,
						infoUrl: 'https://open-meteo.com/en/docs#weather_variable_documentation',
					}),
				]).items,
			} : undefined,
			event.ohsomeEnriched ? {
				label: 'Infrastructure',
				icon: 'ph-bicycle',
				tone: 'green',
				summary: this.eventInfrastructureSummary(event),
				compact: this.formatOptionalValue(event.cyclewayLocation),
				items: this.eventDetailGroup('Cycling infrastructure', [
					this.eventDetailItem('Cycleway location', event.cyclewayLocation),
					this.eventDetailItem('Cycleway type', event.cyclewayType),
				]).items,
			} : undefined,
			event.trafficEnriched ? {
				label: 'Traffic',
				icon: 'ph-traffic-signal',
				tone: 'orange',
				summary: this.formatOptionalValue(event.trafficCondition) ?? 'Unknown',
				compact: this.formatOptionalValue(event.trafficEnrichmentStatus),
				items: this.eventDetailGroup('Traffic', [
					this.eventDetailItem('Condition', event.trafficCondition),
					this.eventDetailItem('Motor vehicle volume', event.trafficVolumeKfz, { suffix: ' vehicles' }),
					this.eventDetailItem('Motor vehicle speed', event.trafficSpeedKfz, { suffix: ' km/h' }),
					this.eventDetailItem('Car volume', event.trafficVolumePkw, { suffix: ' cars' }),
					this.eventDetailItem('Car speed', event.trafficSpeedPkw, { suffix: ' km/h' }),
					this.eventDetailItem('Truck volume', event.trafficVolumeLkw, { suffix: ' trucks' }),
					this.eventDetailItem('Truck speed', event.trafficSpeedLkw, { suffix: ' km/h' }),
				]).items,
			} : undefined,
		];
		return rows.filter((row): row is ConditionRow => row !== undefined && row.items.length > 0);
	}

	protected technicalDetailItems(event: SegmentEvent): EventDetailItem[] {
		return [
			event.trafficEnriched ? this.eventDetailItem('Traffic status', event.trafficEnrichmentStatus) : undefined,
			event.trafficEnriched ? this.eventDetailItem('Traffic source type', event.trafficSourceType) : undefined,
		].filter((item): item is EventDetailItem => item !== undefined);
	}

	private eventWeatherSummary(event: SegmentEvent): string | undefined {
		const parts = [
			this.formatOptionalValue(event.temperature2m, '°C'),
			this.formatOptionalValue(event.precipitation, ' mm'),
			this.formatOptionalValue(event.windSpeed10m, ' km/h'),
		].filter((part): part is string => part !== undefined);
		return parts.length ? parts.join(' · ') : undefined;
	}

	private eventInfrastructureSummary(event: SegmentEvent): string {
		return this.formatOptionalValue(event.cyclewayType)
			?? this.formatOptionalValue(event.highway)
			?? 'No cycleway data';
	}

	private ensureMapLayers(map: maplibregl.Map, generatedAt: number): void {
		if (map.getSource(preferenceAvoidanceSegmentsSource)) {
			return;
		}

		map.addSource(preferenceAvoidanceSegmentsSource, {
			type: 'vector',
			url: this.tileUrl(generatedAt),
		});

		map.addLayer({
			id: preferenceAvoidanceStreetsLayer,
			type: 'line',
			source: preferenceAvoidanceSegmentsSource,
			'source-layer': 'streets',
			maxzoom: segmentDetailMinZoom + segmentLayerTransitionZoom,
			paint: segmentLinePaint,
		});

		map.addLayer({
			id: preferenceAvoidanceSegmentsLayer,
			type: 'line',
			source: preferenceAvoidanceSegmentsSource,
			'source-layer': 'segments',
			minzoom: segmentDetailMinZoom - segmentLayerTransitionZoom,
			paint: segmentLinePaint,
		});

		map.addSource(preferenceAvoidanceMatchedSource, {
			type: 'geojson',
			data: { type: 'FeatureCollection', features: [] },
		});
		map.addLayer({
			id: preferenceAvoidanceMatchedLayer,
			type: 'line',
			source: preferenceAvoidanceMatchedSource,
			layout: { visibility: 'none' },
			paint: {
				'line-color': ['get', 'color'],
				'line-width': ['get', 'width'],
				'line-opacity': 0.88,
			},
		});

		map.addSource(preferenceAvoidanceHighlightSource, {
			type: 'geojson',
			data: { type: 'FeatureCollection', features: [] },
		});

		const hoverAwareOpacity = (selectedOpacity: number, hoverOpacity: number): maplibregl.ExpressionSpecification => [
			'case', ['==', ['get', 'highlightKind'], 'hover'], hoverOpacity, selectedOpacity,
		];

		map.addLayer({
			id: preferenceAvoidanceHighlightOutlineLayer,
			type: 'line',
			source: preferenceAvoidanceHighlightSource,
			paint: {
				'line-color': '#111827',
				'line-width': ['+', ['get', 'eventLineWidth'], 5],
				'line-opacity': hoverAwareOpacity(1, 0.45),
				'line-blur': 0.25,
			},
		});

		map.addLayer({
			id: preferenceAvoidanceHighlightLayer,
			type: 'line',
			source: preferenceAvoidanceHighlightSource,
			paint: {
				'line-color': ['get', 'eventSignalColor'],
				'line-width': ['+', ['get', 'eventLineWidth'], 2],
				'line-opacity': hoverAwareOpacity(1, 0.7),
			},
		});

		map.addSource(trafficDetectorRadiusSource, {
			type: 'geojson',
			data: { type: 'FeatureCollection', features: [] },
		});
		map.addLayer({
			id: trafficDetectorRadiusFillLayer,
			type: 'fill',
			source: trafficDetectorRadiusSource,
			paint: {
				'fill-color': trafficDetectorActiveColor,
				'fill-opacity': 0.12,
			},
		});
		map.addLayer({
			id: trafficDetectorRadiusLineLayer,
			type: 'line',
			source: trafficDetectorRadiusSource,
			paint: {
				'line-color': trafficDetectorActiveColor,
				'line-width': 1.5,
				'line-dasharray': [2, 2],
			},
		});
		map.addSource(trafficDetectorsSource, {
			type: 'geojson',
			data: { type: 'FeatureCollection', features: [] },
		});
		map.addLayer({
			id: trafficDetectorsLayer,
			type: 'circle',
			source: trafficDetectorsSource,
			paint: {
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3.5, 14, 6.5],
				'circle-color': [
					'case',
					['boolean', ['get', 'active'], false],
					trafficDetectorActiveColor,
					trafficDetectorInactiveColor,
				],
				'circle-stroke-color': '#ffffff',
				'circle-stroke-width': 1.5,
				'circle-opacity': 0.95,
			},
		});

		this.applyMapFilters(map);
		this.syncHighlightSource(map);
		this.syncMatchedSource(map);
		this.syncTrafficDetectorSource(map);
		this.syncTrafficDetectorRadiusSource(map);

		if (!this._mapHandlersRegistered) {
			this.registerMapHandlers(map);
			this._mapHandlersRegistered = true;
		}
	}

	private registerMapHandlers(map: maplibregl.Map): void {
		const interactiveLayers = [
			preferenceAvoidanceStreetsLayer,
			preferenceAvoidanceSegmentsLayer,
			preferenceAvoidanceMatchedLayer,
			trafficDetectorsLayer,
		];
		for (const layerId of interactiveLayers) {
			map.on('mouseenter', layerId, () => {
				map.getCanvas().style.cursor = 'pointer';
			});
			map.on('mouseleave', layerId, () => {
				map.getCanvas().style.cursor = 'default';
			});
		}

		const onTileSegmentClick = (event: maplibregl.MapLayerMouseEvent): void => {
			const feature = event.features?.[0];
			if (!feature?.properties) {
				return;
			}

			const properties = feature.properties as unknown as SegmentTileProperties;
			const segmentId = Number(properties.id);
			if (!Number.isFinite(segmentId)) {
				return;
			}

			this.selectSegment(segmentId);
			this._selectedSegmentTileProperties.set(properties);
			this.setSelectedHighlight(map, feature.geometry as LineString | MultiLineString, properties);
		};
		map.on('click', preferenceAvoidanceStreetsLayer, onTileSegmentClick);
		map.on('click', preferenceAvoidanceSegmentsLayer, onTileSegmentClick);

		map.on('click', preferenceAvoidanceMatchedLayer, (event) => {
			const feature = event.features?.[0];
			const segmentId = Number(feature?.properties?.['id']);
			if (!feature || !Number.isFinite(segmentId)) {
				return;
			}

			this.selectSegment(segmentId);
			this.setSelectedHighlight(map, feature.geometry as LineString | MultiLineString, {
				avoidanceCount: Number(feature.properties?.['avoidanceCount'] ?? 0),
				preferenceCount: Number(feature.properties?.['preferenceCount'] ?? 0),
			});
		});

		map.on('click', trafficDetectorsLayer, (event) => {
			const feature = event.features?.[0];
			if (feature) {
				this.selectTrafficDetector(map, feature);
			}
		});

		map.on('click', (event) => {
			const clickableLayers = interactiveLayers
				.filter((layerId) => map.getLayer(layerId));
			if (!clickableLayers.length) {
				return;
			}

			const features = map.queryRenderedFeatures(event.point, { layers: clickableLayers });
			if (features.length === 0) {
				this.selectSegment(undefined);
				this.clearHighlight(map);
				this.clearTrafficDetectorSelection(map);
			}
		});
	}

	private renderCurrentMapState(map: maplibregl.Map): void {
		const generatedAt = this.tileStatus.value()?.generatedAt;
		if (generatedAt) {
			// re-adds the wiped sources/layers and re-syncs the stored highlight
			this.ensureMapLayers(map, generatedAt);
		}
	}

	private tileUrl(generatedAt: number): string {
		const base = this.normalizeApiBase(this._appConfig.apiUrl);
		const origin = !base
			? window.location.origin
			: base.startsWith('/')
				? `${window.location.origin}${base}`
				: base;
		return `pmtiles://${origin}/api/tiles/segments.pmtiles?v=${generatedAt}`;
	}

	private normalizeApiBase(apiUrl: string | undefined): string {
		// same normalization as backendUrlInterceptor
		const normalized = (apiUrl ?? '').trim().replace(/\/+$/, '').replace(/\/api$/i, '');
		if (!normalized || normalized.startsWith('/') || /^[a-z][a-z\d+\-.]*:\/\//i.test(normalized)) {
			return normalized;
		}

		return `http://${normalized}`;
	}

	private mapBaseStyleUrl(style: MapBaseStyle): string {
		const styleId = style === 'SATELLITE' ? 'satellite' : 'basic-v2';
		return `https://api.maptiler.com/maps/${styleId}/style.json?key=${this._mapTilerToken}`;
	}

	private async applyHoverHighlight(
		map: maplibregl.Map,
		segmentId: number,
		isStillRelevant: () => boolean,
	): Promise<void> {
		const segment = await this.resolveSegmentSummary(segmentId);
		if (!segment?.geometry || !isStillRelevant()) {
			return;
		}

		this.setHoverHighlight(map, segment.geometry, segment);
	}

	private async resolveSegmentSummary(segmentId: number): Promise<SegmentSummary | undefined> {
		const cached = this._segmentDetailCache.get(segmentId);
		if (cached?.geometry) {
			return cached;
		}

		try {
			const segment = await firstValueFrom(this._facade.getSegment(segmentId));
			if (segment) {
				this._segmentDetailCache.set(segmentId, segment);
			}
			return segment;
		} catch {
			return undefined;
		}
	}

	private buildHighlightFeature(
		geometry: LineString | MultiLineString,
		segment: HighlightableSegment,
		highlightKind: 'selected' | 'hover',
	): GeoJSON.Feature<LineString | MultiLineString> {
		return {
			type: 'Feature',
			geometry,
			properties: {
				highlightKind,
				eventSignalColor: this.eventSignalColor(segment),
				eventLineWidth: this.eventLineWidth(segment),
				eventBalance: this.eventBalance(segment),
				eventSignalBucket: this.eventSignalBucket(segment),
			},
		};
	}

	private setSelectedHighlight(
		map: maplibregl.Map,
		geometry: LineString | MultiLineString,
		segment: HighlightableSegment,
	): void {
		this._selectedHighlightFeature = this.buildHighlightFeature(geometry, segment, 'selected');
		this.syncHighlightSource(map);
	}

	private setHoverHighlight(
		map: maplibregl.Map,
		geometry: LineString | MultiLineString,
		segment: HighlightableSegment,
	): void {
		this._hoverHighlightFeature = this.buildHighlightFeature(geometry, segment, 'hover');
		this.syncHighlightSource(map);
	}

	private clearSelectedHighlight(map: maplibregl.Map): void {
		if (!this._selectedHighlightFeature) {
			return;
		}
		this._selectedHighlightFeature = undefined;
		this.syncHighlightSource(map);
	}

	private clearHoverHighlight(map: maplibregl.Map): void {
		if (!this._hoverHighlightFeature) {
			return;
		}
		this._hoverHighlightFeature = undefined;
		this.syncHighlightSource(map);
	}

	private clearHighlight(map: maplibregl.Map): void {
		this._selectedHighlightFeature = undefined;
		this._hoverHighlightFeature = undefined;
		this.syncHighlightSource(map);
	}

	protected onTrafficSensorsToggle(): void {
		const enabled = !this.showTrafficSensors();
		this.showTrafficSensors.set(enabled);
		const map = this._map();
		if (!enabled && map) {
			this.clearTrafficDetectorSelection(map);
		}
	}

	private selectTrafficDetector(map: maplibregl.Map, feature: maplibregl.MapGeoJSONFeature): void {
		const properties = feature.properties ?? {};
		const key = String(properties['key'] ?? '');
		if (!key || this.selectedDetectorKey() === key) {
			this.clearTrafficDetectorSelection(map);
			return;
		}

		const [lon, lat] = (feature.geometry as Point).coordinates;
		const radiusMeters = this.trafficDetectors.value()?.matchRadiusMeters ?? 75;

		this.selectedDetectorKey.set(key);
		this._trafficDetectorRadiusFeature = circle([lon, lat], radiusMeters / 1000, {
			steps: 64,
			units: 'kilometers',
		});
		this.syncTrafficDetectorRadiusSource(map);
		this.openTrafficDetectorPopup(map, lon, lat, properties, radiusMeters);
	}

	private clearTrafficDetectorSelection(map: maplibregl.Map): void {
		this.selectedDetectorKey.set(undefined);
		this._trafficDetectorRadiusFeature = undefined;
		this.syncTrafficDetectorRadiusSource(map);
		const popup = this._trafficDetectorPopup;
		this._trafficDetectorPopup = undefined;
		popup?.remove();
	}

	private openTrafficDetectorPopup(
		map: maplibregl.Map,
		lon: number,
		lat: number,
		properties: Record<string, unknown>,
		radiusMeters: number,
	): void {
		this._trafficDetectorPopup?.remove();

		const text = (key: string) => this.escapeHtml(String(properties[key] ?? ''));
		const laneCount = Number(properties['laneCount'] ?? 0);
		const activeLaneCount = Number(properties['activeLaneCount'] ?? 0);
		const activeFrom = String(properties['activeFrom'] ?? '');
		const activeTo = String(properties['activeTo'] ?? '');
		const activePeriod = activeFrom || activeTo
			? `${this.escapeHtml(activeFrom || '?')} – ${activeTo ? this.escapeHtml(activeTo) : 'today'}`
			: '';
		const rows = [
			['Direction', text('directions')],
			['Lane detectors', `${activeLaneCount} of ${laneCount} active`],
			['Active period', activePeriod],
			['Match radius', `${radiusMeters} m`],
			['Detectors', text('detectorNames')],
		].filter(([, value]) => value);

		const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: false, maxWidth: '320px' })
			.setLngLat([lon, lat])
			.setHTML(`
				<div class="detector-popup">
					<h4>${text('street') || 'Traffic sensor'}</h4>
					${properties['position'] ? `<p>${text('position')}${properties['positionDetail'] ? ` · ${text('positionDetail')}` : ''}</p>` : ''}
					<dl>
						${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}
					</dl>
				</div>
			`)
			.addTo(map);
		popup.on('close', () => {
			if (this._trafficDetectorPopup === popup) {
				this._trafficDetectorPopup = undefined;
				this.clearTrafficDetectorSelection(map);
			}
		});
		this._trafficDetectorPopup = popup;
	}

	private escapeHtml(value: string): string {
		const replacements: Record<string, string> = {
			'&': '&amp;',
			'<': '&lt;',
			'>': '&gt;',
			'"': '&quot;',
			"'": '&#39;',
		};
		return value.replace(/[&<>"']/g, (character) => replacements[character]);
	}

	private syncTrafficDetectorSource(map: maplibregl.Map): void {
		const source = map.getSource(trafficDetectorsSource) as maplibregl.GeoJSONSource | undefined;
		if (!source) {
			return;
		}
		source.setData({ type: 'FeatureCollection', features: this._trafficDetectorFeatures });
	}

	private syncTrafficDetectorRadiusSource(map: maplibregl.Map): void {
		const source = map.getSource(trafficDetectorRadiusSource) as maplibregl.GeoJSONSource | undefined;
		if (!source) {
			return;
		}
		const features = this._trafficDetectorRadiusFeature ? [this._trafficDetectorRadiusFeature] : [];
		source.setData({ type: 'FeatureCollection', features });
	}

	private syncMatchedSource(map: maplibregl.Map): void {
		const source = map.getSource(preferenceAvoidanceMatchedSource) as maplibregl.GeoJSONSource | undefined;
		if (!source) {
			return;
		}
		source.setData({ type: 'FeatureCollection', features: this._matchedOverlayFeatures });
	}

	private syncHighlightSource(map: maplibregl.Map): void {
		const source = map.getSource(preferenceAvoidanceHighlightSource) as maplibregl.GeoJSONSource | undefined;
		if (!source) {
			return;
		}

		const features = [this._selectedHighlightFeature, this._hoverHighlightFeature]
			.filter((feature): feature is GeoJSON.Feature<LineString | MultiLineString> => feature !== undefined);
		source.setData({ type: 'FeatureCollection', features });
	}

	private applyMapFilters(map: maplibregl.Map): void {
		const year = this.selectedYear();
		const bucketProperty = year !== undefined ? `bucket_${year}` : 'bucket';
		const countProperty = year !== undefined ? `eventCount_${year}` : 'eventCount';

		const clauses: maplibregl.ExpressionSpecification[] = [
			year !== undefined
				? ['>', ['coalesce', ['get', countProperty], 0], 0]
				: ['any',
					['>=', ['coalesce', ['get', 'totalObservationCount'], 0], mapMinSampleSize],
					['>', ['coalesce', ['get', 'eventCount'], 0], 0],
				],
		];

		const selectedBuckets = this.selectedRiskLegendBuckets();
		if (selectedBuckets.length) {
			clauses.push(['in', ['get', bucketProperty], ['literal', selectedBuckets]]);
		}

		for (const filter of this.selectedEnrichmentFilters()) {
			clauses.push(['>', ['coalesce', ['get', enrichmentFilterCountProperty[filter]], 0], 0]);
		}

		const overlayActive = this.matchedOverlayActive();
		const segmentsVisible = this.showSegmentEvents();
		const tileLayerFilter = ['all', ...clauses] as maplibregl.FilterSpecification;
		[preferenceAvoidanceStreetsLayer, preferenceAvoidanceSegmentsLayer].forEach((layerId) => {
			if (map.getLayer(layerId)) {
				map.setFilter(layerId, tileLayerFilter);
				map.setPaintProperty(layerId, 'line-color', bucketColorExpression(bucketProperty));
				map.setPaintProperty(layerId, 'line-width', eventLineWidthExpression(countProperty));
				map.setLayoutProperty(layerId, 'visibility', overlayActive || !segmentsVisible ? 'none' : 'visible');
			}
		});

		if (map.getLayer(preferenceAvoidanceMatchedLayer)) {
			map.setLayoutProperty(
				preferenceAvoidanceMatchedLayer,
				'visibility',
				overlayActive && segmentsVisible ? 'visible' : 'none',
			);
			map.setFilter(
				preferenceAvoidanceMatchedLayer,
				selectedBuckets.length
					? (['in', ['get', 'bucket'], ['literal', selectedBuckets]] as maplibregl.FilterSpecification)
					: null,
			);
		}

		// highlight features only carry the legend bucket, so they only follow that filter
		const highlightFilter = selectedBuckets.length
			? (['in', ['get', 'eventSignalBucket'], ['literal', selectedBuckets]] as maplibregl.FilterSpecification)
			: null;
		[preferenceAvoidanceHighlightOutlineLayer, preferenceAvoidanceHighlightLayer].forEach((layerId) => {
			if (map.getLayer(layerId)) {
				map.setFilter(layerId, highlightFilter);
			}
		});
	}

	private tilePropertiesMatchFilters(
		properties: SegmentTileProperties,
		filters: SegmentEnrichmentFilter[],
		year?: number,
	): boolean {
		const yearEventCount = (properties as unknown as Record<string, unknown>)[`eventCount_${year}`];
		return (year === undefined || Number(yearEventCount ?? 0) > 0)
			&& filters.every((filter) => Number(properties[enrichmentFilterCountProperty[filter]] ?? 0) > 0);
	}

	private eventSignalColor(segment?: HighlightableSegment): string {
		return riskLegendColors[this.eventSignalBucket(segment)];
	}

	private eventSignalBucket(segment?: HighlightableSegment): RiskLegendBucket {
		const balance = this.eventBalance(segment);
		const eventCount = (segment?.avoidanceCount ?? 0) + (segment?.preferenceCount ?? 0);
		if (eventCount === 0) {
			return 'NO_EVENTS';
		}
		if (balance <= -0.6) {
			return 'AVOIDANCE_STRONG';
		}
		if (balance <= -0.3) {
			return 'AVOIDANCE';
		}
		if (balance <= -0.1) {
			return 'AVOIDANCE_LIGHT';
		}
		if (balance >= 0.6) {
			return 'PREFERENCE_STRONG';
		}
		if (balance >= 0.3) {
			return 'PREFERENCE';
		}
		if (balance >= 0.1) {
			return 'PREFERENCE_LIGHT';
		}
		return 'BASELINE';
	}

	private eventLineWidth(segment?: Pick<SegmentSummary, 'avoidanceCount' | 'preferenceCount'>): number {
		const events = (segment?.avoidanceCount ?? 0) + (segment?.preferenceCount ?? 0);
		return Math.min(8, Math.max(1.5, 1.5 + Math.log10(events + 1) * 2.2));
	}

	private eventBalance(segment?: HighlightableSegment): number {
		const avoidance = segment?.avoidanceCount ?? 0;
		const preference = segment?.preferenceCount ?? 0;
		const total = avoidance + preference;
		if (total === 0) {
			return 0;
		}
		return ((preference - avoidance) / total) * Math.min(1, Math.log10(total + 1));
	}

	private selectSegment(segmentId: number | undefined): void {
		if (this.selectedSegmentId() !== segmentId) {
			this.selectedEventId.set(undefined);
			this.selectedInfoPopoverId.set(undefined);
			this._selectedSegmentTileProperties.set(undefined);
		}
		this.selectedSegmentId.set(segmentId);
	}

	private async loadQualifiedSegmentIds(
		segmentIds: number[],
		criteria: EventQualificationCriteria,
	): Promise<Set<number>> {
		const qualifiedIds = new Set<number>();
		const batchSize = 16;

		for (let index = 0; index < segmentIds.length; index += batchSize) {
			const batch = segmentIds.slice(index, index + batchSize);
			const batchResults = await Promise.all(batch.map(async (segmentId) => {
				const events = await firstValueFrom(this._facade.getSegmentEvents(segmentId, {
					enrichmentFilters: this.enrichmentFiltersParam(criteria.enrichmentFilters),
					...this.yearRange(criteria.year),
					limit: 1000,
				}));
				return events.some((event) => this.eventMatchesQualificationCriteria(event, criteria))
					? segmentId
					: undefined;
			}));

			batchResults
				.filter((segmentId): segmentId is number => segmentId !== undefined)
				.forEach((segmentId) => qualifiedIds.add(segmentId));
		}

		return qualifiedIds;
	}

	private enrichmentFiltersParam(filters: SegmentEnrichmentFilter[]): SegmentEnrichmentFilter[] | undefined {
		return filters.length ? filters : undefined;
	}

	private yearRange(year: number | undefined): { from?: number; to?: number } {
		if (!year) {
			return {};
		}
		return { from: Date.UTC(year, 0, 1), to: Date.UTC(year + 1, 0, 1) - 1 };
	}

	private segmentMatchesPropertyFilters(segment: SegmentSummary): boolean {
		const minIncidents = this.normalizedMinIncidents();
		return minIncidents === null || (segment.incidentCount ?? 0) >= minIncidents;
	}

	private eventMatchesAllEnrichmentFilters(event: SegmentEvent, filters: SegmentEnrichmentFilter[]): boolean {
		return filters.every((filter) => this.eventMatchesEnrichmentFilter(event, filter));
	}

	private eventMatchesQualificationCriteria(event: SegmentEvent, criteria: EventQualificationCriteria): boolean {
		return this.eventMatchesAllEnrichmentFilters(event, criteria.enrichmentFilters)
			&& (!criteria.rideIntent || event.rideIntent === criteria.rideIntent)
			&& (!criteria.trafficCondition || event.trafficCondition === criteria.trafficCondition);
	}

	private eventMatchesEnrichmentFilter(event: SegmentEvent, filter: SegmentEnrichmentFilter): boolean {
		if (filter === 'WEATHER_ENRICHED') {
			return event.weatherEnriched;
		}
		if (filter === 'OHSOME_ENRICHED') {
			return event.ohsomeEnriched;
		}
		// Mirrors the backend's trafficMeasuredEventCount: an event is "measured" when a
		// detector measurement was attached (status ENRICHED, e.g. source OLD_DETECTOR),
		// as opposed to NO_DETECTOR_MATCH / NO_MEASUREMENT.
		return event.trafficEnriched
			&& String(event.trafficEnrichmentStatus ?? '').toUpperCase() === 'ENRICHED';
	}

	private topContext<T extends keyof SegmentEvent>(
		events: SegmentEvent[],
		key: T,
		label: string,
	): ContextHighlight | undefined {
		const counts = events.reduce((currentCounts, event) => {
			const rawValue = event[key];
			const value = this.formatOptionalValue(rawValue);
			if (!value) {
				return currentCounts;
			}
			currentCounts.set(value, (currentCounts.get(value) ?? 0) + 1);
			return currentCounts;
		}, new Map<string, number>());

		const [value, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? [];
		if (!value) {
			return undefined;
		}

		return {
			label,
			value,
			count,
		};
	}

	private eventChip(
		label: string,
		value: unknown,
		tone: EventChip['tone'],
		suffix = '',
	): EventChip | undefined {
		const formattedValue = this.formatOptionalValue(value, suffix);
		return formattedValue ? { label, value: formattedValue, tone } : undefined;
	}

	private eventDetailGroup(label: EventDetailGroup['label'], items: (EventDetailItem | undefined)[]): EventDetailGroup {
		return {
			label,
			items: items.filter((item): item is EventDetailItem => item !== undefined),
		};
	}

	private eventDetailItem(
		label: string,
		value: unknown,
		options: { suffix?: string; formatBucket?: boolean; infoId?: string; infoUrl?: string } = {},
	): EventDetailItem | undefined {
		const formattedValue = this.formatOptionalValue(value, options.suffix ?? '', options.formatBucket ?? true);
		return formattedValue ? { label, value: formattedValue, infoId: options.infoId, infoUrl: options.infoUrl } : undefined;
	}

	private formatWeatherCode(code: number | null | undefined): string | undefined {
		if (code === null || code === undefined) {
			return undefined;
		}

		const description = this.weatherCodeDescription(code);
		return description ? `${code} - ${description}` : String(code);
	}

	private weatherCodeDescription(code: number): string | undefined {
		if (code === 0) {
			return 'Clear sky';
		}
		if ([1, 2, 3].includes(code)) {
			return 'Mainly clear, partly cloudy, and overcast';
		}
		if ([45, 48].includes(code)) {
			return 'Fog and depositing rime fog';
		}
		if ([51, 53, 55].includes(code)) {
			return 'Drizzle: Light, moderate, and dense intensity';
		}
		if ([56, 57].includes(code)) {
			return 'Freezing Drizzle: Light and dense intensity';
		}
		if ([61, 63, 65].includes(code)) {
			return 'Rain: Slight, moderate and heavy intensity';
		}
		if ([66, 67].includes(code)) {
			return 'Freezing Rain: Light and heavy intensity';
		}
		if ([71, 73, 75].includes(code)) {
			return 'Snow fall: Slight, moderate, and heavy intensity';
		}
		if (code === 77) {
			return 'Snow grains';
		}
		if ([80, 81, 82].includes(code)) {
			return 'Rain showers: Slight, moderate, and violent';
		}
		if ([85, 86].includes(code)) {
			return 'Snow showers slight and heavy';
		}
		if (code === 95) {
			return 'Thunderstorm: Slight or moderate';
		}
		if ([96, 99].includes(code)) {
			return 'Thunderstorm with slight and heavy hail';
		}
		return undefined;
	}

	private formatOptionalValue(value: unknown, suffix = '', formatBucket = true): string | undefined {
		if (value === null || value === undefined || value === '') {
			return undefined;
		}
		if (typeof value === 'boolean') {
			return value ? 'Yes' : 'No';
		}
		if (typeof value === 'number') {
			return `${value.toLocaleString('en', { maximumFractionDigits: 1 })}${suffix}`;
		}
		return formatBucket ? this.formatBucketValue(String(value)) : String(value);
	}

	private formatPlainValue(value: unknown): string {
		return this.formatOptionalValue(value, '', false) ?? '-';
	}

	private formatNumber(value: number): string {
		return value.toLocaleString('en');
	}

	private formatTraffic(segment?: SegmentSummary): string {
		const volume = this.numberOrUndefined(segment?.traffic?.averageTrafficVolumeKfz);
		const speed = this.numberOrUndefined(segment?.traffic?.averageTrafficSpeedKfz);
		if (volume === undefined && speed === undefined) {
			return '-';
		}
		if (volume !== undefined && speed !== undefined) {
			return `${volume.toFixed(0)} vehicles / ${speed.toFixed(1)} km/h`;
		}
		if (volume !== undefined) {
			return `${volume.toFixed(0)} vehicles`;
		}
		return `${speed?.toFixed(1)} km/h`;
	}

	private numberOrUndefined(value: number | null | undefined): number | undefined {
		return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
	}

	private async reverseGeocode(segmentId: number, lon: number, lat: number): Promise<string | undefined> {
		if (this._addressCache.has(segmentId)) {
			return this._addressCache.get(segmentId);
		}

		let address: string | undefined;
		try {
			const response = await fetch(
				`https://api.maptiler.com/geocoding/${lon},${lat}.json?key=${this._mapTilerToken}&limit=1`,
			);
			if (response.ok) {
				const body = await response.json() as {
					features?: { context?: { id?: string; text?: string }[] }[];
				};
				const context = body.features?.[0]?.context ?? [];
				const contextText = (...idPrefixes: string[]) => {
					for (const prefix of idPrefixes) {
						const match = context.find((item) => item.id?.startsWith(prefix))?.text;
						if (match) {
							return match;
						}
					}
					return undefined;
				};
				const postcode = contextText('postal_code');
				const city = contextText('municipality', 'city', 'county', 'place');
				address = [postcode, city].filter(Boolean).join(' ') || undefined;
			}
		} catch {
			address = undefined;
		}

		this._addressCache.set(segmentId, address);
		return address;
	}

	private formatIncidentBreakdown(segment?: SegmentSummary): string | undefined {
		const breakdown = segment?.incidentBreakdown ?? [];
		if (!breakdown.length) {
			return undefined;
		}
		return breakdown
			.slice(0, 2)
			.map((incident) => `${this.formatBucketValue(incident.incidentType)} ${incident.count}`)
			.join(', ');
	}

	private formatExternalFactors(segment?: SegmentSummary): string | undefined {
		const factors = segment?.externalFactors ?? [];
		if (!factors.length) {
			return undefined;
		}
		const uniqueTypes = [...new Set(factors.map((factor) => this.formatBucketValue(factor.factorType)))];
		return uniqueTypes.slice(0, 3).join(', ');
	}

	private formatBucketValue(value: string): string {
		return value
			.toLowerCase()
			.split('_')
			.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
			.join(' ');
	}
}
