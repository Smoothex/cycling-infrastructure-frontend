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
	AnalyticsFilters,
	CorridorGeometry,
	CorridorRanking,
	ExternalFactor,
	SegmentEnrichmentFilter,
	SegmentEvent,
	SegmentEventType,
	SegmentsGeoJson,
	SegmentSummary,
	NearMissIncident,
	RoadClosure,
	RiskBucket,
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
import { PrimeTemplate } from 'primeng/api';
import { Card } from 'primeng/card';
import { Checkbox } from 'primeng/checkbox';
import { Popover } from 'primeng/popover';
import { Skeleton } from 'primeng/skeleton';
import { AnalyticsDashboardComponent } from '../../../components/analytics-dashboard/component/analytics-dashboard.component';
import { RouteComparisonReviewerComponent } from '../../../components/route-comparison-reviewer/component/route-comparison-reviewer.component';
import { SegmentsTableComponent } from '../../../components/segments-table/component/segments-table.component';
import {
	calculateEventBalance,
	classifyRiskBucket,
	RISK_BUCKET_COLORS,
	RISK_LEGEND_ITEMS,
	RiskLegendBucket,
} from '../../../models/risk-buckets';

const preferenceAvoidanceSegmentsSource = 'preference-avoidance-segments-source';
const preferenceAvoidanceCorridorStreetsLayer = 'preference-avoidance-corridor-streets-layer';
const preferenceAvoidanceCorridorSegmentsLayer = 'preference-avoidance-corridor-segments-layer';
const preferenceAvoidanceCorridorGeometrySource = 'preference-avoidance-corridor-geometry-source';
const preferenceAvoidanceCorridorGeometryLayer = 'preference-avoidance-corridor-geometry-layer';
const preferenceAvoidanceStreetsLayer = 'preference-avoidance-streets-layer';
const preferenceAvoidanceSegmentsLayer = 'preference-avoidance-segments-layer';
const preferenceAvoidanceMatchedSource = 'preference-avoidance-matched-source';
const preferenceAvoidanceMatchedLayer = 'preference-avoidance-matched-layer';
const preferenceAvoidanceHighlightSource = 'preference-avoidance-segments-highlight-source';
const preferenceAvoidanceHighlightOutlineLayer =
	'preference-avoidance-segments-highlight-outline-layer';
const preferenceAvoidanceHighlightLayer = 'preference-avoidance-segments-highlight-layer';
const trafficDetectorsSource = 'preference-avoidance-traffic-detectors-source';
const trafficDetectorsLayer = 'preference-avoidance-traffic-detectors-layer';
const trafficDetectorRadiusSource = 'preference-avoidance-traffic-detector-radius-source';
const trafficDetectorRadiusFillLayer = 'preference-avoidance-traffic-detector-radius-fill-layer';
const trafficDetectorRadiusLineLayer = 'preference-avoidance-traffic-detector-radius-line-layer';
const trafficDetectorActiveColor = '#d97706';
const trafficDetectorInactiveColor = '#9ca3af';
const nearMissIncidentsSource = 'preference-avoidance-near-miss-incidents-source';
const nearMissIncidentsLayer = 'preference-avoidance-near-miss-incidents-layer';
const nearMissIncidentColor = '#dc2626';
const nearMissIncidentStrokeColor = '#7f1d1d';
const nearMissIncidentTypeLabels: Record<string, string> = {
	CLOSE_PASS: 'Close pass',
	PULLING_IN_OUT: 'Vehicle pulling in/out',
	NEAR_HOOK: 'Near left/right hook',
	HEAD_ON: 'Head-on approach',
	TAILGATING: 'Tailgating',
	NEAR_DOORING: 'Near dooring',
	DODGING: 'Dodging an obstacle',
	OTHER: 'Other',
	NOTHING: 'Unspecified',
	DUMMY: 'Unspecified',
};
const roadClosuresSource = 'preference-avoidance-road-closures-source';
const roadClosuresLineLayer = 'preference-avoidance-road-closures-line-layer';
const roadClosuresPointLayer = 'preference-avoidance-road-closures-point-layer';
const roadClosuresSymbolLayer = 'preference-avoidance-road-closures-symbol-layer';
const roadClosureColor = '#b91c1c';
const roadClosureWarningImageId = 'preference-avoidance-road-closure-warning';
const roadClosureTypeLabels: Record<string, string> = {
	CONSTRUCTION: 'Construction site',
	ROAD_CLOSURE: 'Road closure',
	EVENT: 'Disruption',
	HAZARD: 'Hazard',
	INCIDENT: 'Accident',
};
const roadClosureSeverityLabels: Record<string, string> = {
	NO_CLOSURE: 'No closure',
	FULL_CLOSURE: 'Full closure',
	DIRECTIONAL_CLOSURE: 'One direction closed',
	UNKNOWN: '',
};
const cyclewayTypeLabels: Record<string, string> = {
	TRACK: 'Protected cycle track',
	LANE: 'Cycle lane',
	SHARED_LANE: 'Shared lane',
	SHARE_BUSWAY: 'Shared bus lane',
	SEPARATE: 'Separate cycleway',
	CROSSING: 'Cycle crossing',
};
const cyclewayLocationLabels: Record<string, string> = {
	LEFT: 'Left side',
	RIGHT: 'Right side',
	BOTH: 'Both sides',
};
const omittedContextValues = new Set(['NONE', 'UNKNOWN', 'NOT_APPLICABLE', 'N/A', 'NULL']);
const berlinMapCenter: [number, number] = [13.413, 52.522];
const berlinMapZoom = 14;
// below this zoom the tileset only contains the aggregated 'streets' layer
const segmentDetailMinZoom = 12;
const segmentLayerTransitionZoom = 1;
const mapMinSampleSize = 10;
const minSelectableEventYear = 2015; // avoide test/noise rides

let pmtilesProtocolRegistered = false;
function registerPmtilesProtocol(): void {
	if (pmtilesProtocolRegistered) {
		return;
	}
	const protocol = new Protocol();
	maplibregl.addProtocol('pmtiles', (params, abortController) =>
		protocol.tile(params, abortController),
	);
	pmtilesProtocolRegistered = true;
}

type EventFilter = 'ALL' | SegmentEventType;
type PanelViewMode = 'INFO' | 'EVENTS';
type MapBaseStyle = 'MAP' | 'SATELLITE';
type ExplorerTab = 'MAP' | 'ANALYTICS' | 'SEGMENTS' | 'ROUTE_COMPARISONS';

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
// map to the per-segment enrichment event counts baked into the tile properties
const enrichmentFilterCountProperty: Record<SegmentEnrichmentFilter, keyof SegmentTileProperties> =
	{
		TRAFFIC_ENRICHED: 'trafficEnrichedEventCount',
		WEATHER_ENRICHED: 'weatherEnrichedEventCount',
		OHSOME_ENRICHED: 'ohsomeEnrichedEventCount',
		TRAFFIC_MEASURED: 'trafficMeasuredEventCount',
		ROAD_DISRUPTION_AFFECTED: 'roadDisruptionAffectedEventCount',
	};

// the tiles carry all-time properties (bucket/eventCount) plus per-year variants
// (bucket_<year>/eventCount_<year>), so year views restyle the same tile layers
function bucketColorExpression(bucketProperty: string): maplibregl.ExpressionSpecification {
	const [firstItem, ...remainingItems] = RISK_LEGEND_ITEMS;

	return [
		'match',
		['get', bucketProperty],
		firstItem.bucket,
		firstItem.color,
		...remainingItems.flatMap(({ bucket, color }) => [bucket, color]),
		RISK_BUCKET_COLORS.NO_EVENTS,
	];
}

// replicates eventLineWidth(): min(8, max(1.5, 1.5 + log10(events + 1) * 2.2))
function eventLineWidthExpression(countProperty: string): maplibregl.ExpressionSpecification {
	return [
		'min',
		8,
		[
			'max',
			1.5,
			['+', 1.5, ['*', 2.2, ['log10', ['+', ['coalesce', ['get', countProperty], 0], 1]]]],
		],
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
	wide?: boolean;
	infoId?: string;
	infoUrl?: string;
}

interface EventDetailGroup {
	label: 'Ride' | 'Weather' | 'Cycling infrastructure' | 'Traffic';
	items: EventDetailItem[];
}

interface ConditionDetailGroup {
	id: string;
	label: string;
	tone: 'green' | 'red';
	items: EventDetailItem[];
	description?: string;
}

type IconTone = 'blue' | 'green' | 'purple' | 'orange' | 'red';

/** One expandable row of the event-time context card inside an event card. */
interface ConditionRow {
	label: 'Weather' | 'Infrastructure' | 'Traffic' | 'Road disruption';
	icon: string;
	tone: IconTone;
	summary: string;
	items: EventDetailItem[];
	detailGroups?: ConditionDetailGroup[];
}

/** One tile of the data-processing summary strip shown on the Map Explorer tab. */
interface SummaryKpi {
	label: string;
	value: number;
	icon: string;
	tone: IconTone;
}

/** Status recorded successfully once detour analysis has finished for a ride. */
const processedRideStatus = 'PROCESSED';

@Component({
	selector: 't-preference-avoidance-page',
	standalone: true,
	imports: [
		FormsModule,
		MapPage,
		Card,
		Checkbox,
		Popover,
		Skeleton,
		DecimalPipe,
		PrimeTemplate,
		AnalyticsDashboardComponent,
		RouteComparisonReviewerComponent,
		SegmentsTableComponent,
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
	private readonly _selectedSegmentTileProperties = signal<SegmentTileProperties | undefined>(
		undefined,
	);
	private readonly _selectionPinned = signal(false);
	private readonly _segmentDetailCache = new Map<number, SegmentSummary>();
	private readonly _addressCache = new Map<number, string | undefined>();
	private _mapHandlersRegistered = false;
	private _selectedHighlightFeature?: GeoJSON.Feature<LineString | MultiLineString>;
	private _hoverHighlightFeature?: GeoJSON.Feature<LineString | MultiLineString>;
	private _corridorGeometryFeature?: GeoJSON.Feature<MultiLineString>;
	private _corridorRequestVersion = 0;
	private _matchedOverlayFeatures: GeoJSON.Feature<LineString>[] = [];
	private _trafficDetectorFeatures: GeoJSON.Feature<Point>[] = [];
	private _trafficDetectorRadiusFeature?: GeoJSON.Feature<Polygon>;
	private _trafficDetectorPopup?: maplibregl.Popup;
	private _nearMissIncidentFeatures: GeoJSON.Feature<Point>[] = [];
	private _nearMissIncidentPopup?: maplibregl.Popup;
	private _roadClosureFeatures: GeoJSON.Feature<Point | MultiLineString>[] = [];
	private _roadClosurePopup?: maplibregl.Popup;

	protected readonly selectedMapBaseStyle = signal<MapBaseStyle>('MAP');
	protected readonly showTrafficSensors = signal(false);
	protected readonly showNearMissIncidents = signal(false);
	protected readonly showRoadClosures = signal(false);
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
	protected readonly selectedRiskLegendBuckets = signal<RiskLegendBucket[]>([]);
	protected readonly selectedEnrichmentFilters = signal<SegmentEnrichmentFilter[]>([]);
	// undefined = "All time"
	protected readonly selectedYear = signal<number | undefined>(undefined);
	protected readonly selectedRideIntent = signal<string | undefined>(undefined);
	protected readonly selectedTrafficCondition = signal<string | undefined>(undefined);
	protected readonly selectedCorridorSegmentIds = signal<number[]>([]);
	protected readonly selectedTab = signal<ExplorerTab>('MAP');
	protected readonly routeReviewDirty = signal(false);
	protected readonly pendingTab = signal<ExplorerTab | undefined>(undefined);
	protected readonly riskLegendItems = RISK_LEGEND_ITEMS;
	protected readonly tabOptions: { label: string; value: ExplorerTab; icon: string }[] = [
		{ label: 'Map Explorer', value: 'MAP', icon: 'ph-map-trifold' },
		{ label: 'Analytics', value: 'ANALYTICS', icon: 'ph-chart-bar' },
		{ label: 'Segments', value: 'SEGMENTS', icon: 'ph-table' },
		{ label: 'Route comparisons', value: 'ROUTE_COMPARISONS', icon: 'ph-git-diff' },
	];
	protected readonly enrichmentChipOptions: {
		label: string;
		description: string;
		value: SegmentEnrichmentFilter;
	}[] = [
		{
			label: 'Weather',
			description: 'Events with matched weather data',
			value: 'WEATHER_ENRICHED',
		},
		{
			label: 'Cycling infrastructure',
			description:
				'Events with OpenStreetMap infrastructure data applicable at the event date',
			value: 'OHSOME_ENRICHED',
		},
		{
			label: 'Traffic measurements',
			description: 'Events with matched traffic detector measurements',
			value: 'TRAFFIC_MEASURED',
		},
		{
			label: 'Road disruptions',
			description: 'Events affected by a construction, closure, event, hazard, or incident',
			value: 'ROAD_DISRUPTION_AFFECTED',
		},
	];
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

	protected readonly summaryKpis = computed<SummaryKpi[]>(() => {
		const summary = this.summaryStats.value();
		if (!summary) {
			return [];
		}
		return [
			{ label: 'Total rides', value: summary.totalRides, icon: 'ph-bicycle', tone: 'blue' },
			{
				label: 'Processed rides',
				value: summary.rideStatusCounts[processedRideStatus] ?? 0,
				icon: 'ph-check-circle',
				tone: 'green',
			},
			{
				label: 'Segment events',
				value: summary.totalSegmentEvents,
				icon: 'ph-share-network',
				tone: 'purple',
			},
			{
				label: 'Observed segments',
				value: summary.observedSegments,
				icon: 'ph-path',
				tone: 'orange',
			},
			{
				label: 'Weather data',
				value: summary.weatherEnrichedEvents,
				icon: 'ph-cloud-rain',
				tone: 'blue',
			},
			{
				label: 'Cycling infrastructure data',
				value: summary.ohsomeEnrichedEvents,
				icon: 'ph-road-horizon',
				tone: 'green',
			},
			{
				label: 'Traffic measurements',
				value: summary.trafficMeasuredEvents,
				icon: 'ph-traffic-signal',
				tone: 'orange',
			},
		];
	});

	protected readonly segmentPool = resource<SegmentSummary[], string>({
		params: () =>
			[
				this.segmentPoolLimit(),
				[...this.selectedEnrichmentFilters()].sort().join(','),
				this.selectedYear() ?? '',
				this.selectedRideIntent() ?? '',
				this.selectedTrafficCondition() ?? '',
			].join('|'),
		defaultValue: [],
		loader: async ({ params }) => {
			const [limit, filters, year, rideIntent, trafficCondition] = params.split('|');
			return firstValueFrom(
				this._facade.getSegments({
					minAvoidanceRatio: 0,
					minSampleSize: 1,
					limit: Number(limit),
					...this.yearRange(year ? Number(year) : undefined),
					enrichmentFilters: this.enrichmentFiltersParam(
						filters ? (filters.split(',') as SegmentEnrichmentFilter[]) : [],
					),
					rideIntent: rideIntent || undefined,
					trafficCondition: trafficCondition || undefined,
				}),
			);
		},
	});

	protected readonly tileStatus = resource<TileStatus | undefined, unknown>({
		loader: async () => firstValueFrom(this._facade.getTileStatus()).catch(() => undefined),
	});

	protected readonly trafficDetectors = resource<
		TrafficDetectorsResponse | undefined,
		boolean | undefined
	>({
		params: () => this.showTrafficSensors() || undefined,
		loader: async () =>
			firstValueFrom(this._facade.getTrafficDetectors()).catch(() => undefined),
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
					directions: [
						...new Set(detectors.map((detector) => detector.direction).filter(Boolean)),
					].join(' · '),
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

	protected readonly nearMissIncidents = resource<
		NearMissIncident[] | undefined,
		string | undefined
	>({
		params: () => (this.showNearMissIncidents() ? `${this.selectedYear() ?? ''}` : undefined),
		loader: async ({ params }) =>
			firstValueFrom(
				this._facade.getNearMissIncidents(
					this.yearRange(params ? Number(params) : undefined),
				),
			).catch(() => undefined),
	});

	private readonly nearMissIncidentFeatures = computed<GeoJSON.Feature<Point>[]>(() =>
		(this.nearMissIncidents.value() ?? []).map((incident) => ({
			type: 'Feature' as const,
			geometry: { type: 'Point' as const, coordinates: [incident.lon, incident.lat] },
			properties: {
				id: incident.id,
				timestamp: incident.timestamp ?? 0,
				incidentType: incident.incidentType ?? '',
				description: incident.description ?? '',
				participants: (incident.involvedParticipants ?? []).join(','),
			},
		})),
	);

	protected readonly roadClosures = resource<RoadClosure[] | undefined, string | undefined>({
		params: () => (this.showRoadClosures() ? `${this.selectedYear() ?? ''}` : undefined),
		loader: async ({ params }) =>
			firstValueFrom(
				this._facade.getRoadClosures(this.yearRange(params ? Number(params) : undefined)),
			).catch(() => undefined),
	});

	private readonly roadClosureFeatures = computed<GeoJSON.Feature<Point | MultiLineString>[]>(
		() =>
			(this.roadClosures.value() ?? []).flatMap((closure) => {
				const properties = {
					id: closure.id,
					factorType: closure.factorType ?? '',
					severity: closure.severity ?? '',
					direction: closure.direction ?? '',
					street: closure.street ?? '',
					section: closure.section ?? '',
					content: closure.content ?? '',
					validFrom: closure.validFrom ?? 0,
					validTo: closure.validTo ?? 0,
					marker:
						closure.factorType === 'ROAD_CLOSURE' || closure.severity === 'FULL_CLOSURE'
							? 'warning'
							: 'circle',
				};
				const features: GeoJSON.Feature<Point | MultiLineString>[] = [];
				if (closure.lines?.length) {
					features.push({
						type: 'Feature' as const,
						geometry: { type: 'MultiLineString' as const, coordinates: closure.lines },
						properties,
					});
				}
				features.push({
					type: 'Feature' as const,
					geometry: { type: 'Point' as const, coordinates: [closure.lon, closure.lat] },
					properties,
				});
				return features;
			}),
	);

	protected readonly selectedSegmentDetails = resource<
		SegmentSummary | undefined,
		number | undefined
	>({
		params: () => this.selectedSegmentId(),
		loader: async ({ params }) => this.resolveSegmentSummary(params),
	});

	protected readonly selectedSegmentAddress = resource<
		string | undefined,
		| {
				segmentId: number;
				lon: number;
				lat: number;
		  }
		| undefined
	>({
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

	protected readonly selectedSegmentEvents = resource<
		SegmentEvent[],
		| {
				segmentId: number;
				eventFilter: EventFilter;
				year?: number;
				enrichmentFilters: SegmentEnrichmentFilter[];
				rideIntent?: string;
				trafficCondition?: string;
		  }
		| undefined
	>({
		params: () => {
			const segmentId = this.selectedSegmentId();
			if (!segmentId) {
				return undefined;
			}

			return {
				segmentId,
				eventFilter: this.selectedEventFilter(),
				year: this.selectedYear(),
				enrichmentFilters: this.selectedEnrichmentFilters(),
				rideIntent: this.selectedRideIntent(),
				trafficCondition: this.selectedTrafficCondition(),
			};
		},
		defaultValue: [],
		loader: async ({ params }) => {
			return firstValueFrom(
				this._facade.getSegmentEvents(params.segmentId, {
					eventType: params.eventFilter === 'ALL' ? undefined : params.eventFilter,
					...this.yearRange(params.year),
					enrichmentFilters: this.enrichmentFiltersParam(params.enrichmentFilters),
					rideIntent: params.rideIntent,
					trafficCondition: params.trafficCondition,
					limit: 1000,
				}),
			);
		},
	});

	protected readonly filteredSelectedSegmentEvents = computed(
		() => this.selectedSegmentEvents.value() ?? [],
	);

	private readonly segmentPoolLimit = computed<number>(() => {
		return this.segmentFiltersActive() ? 250 : 50;
	});

	protected readonly segmentFiltersActive = computed(() => {
		return (
			this.selectedRideIntent() !== undefined ||
			this.selectedTrafficCondition() !== undefined ||
			this.selectedYear() !== undefined ||
			this.selectedEnrichmentFilters().length > 0
		);
	});

	protected readonly matchedOverlayActive = computed(() => {
		return (
			this.selectedRideIntent() !== undefined ||
			this.selectedTrafficCondition() !== undefined ||
			this.selectedEnrichmentFilters().length > 0
		);
	});

	protected readonly globalFiltersActive = computed(
		() => this.segmentFiltersActive() || this.selectedRiskLegendBuckets().length > 0,
	);

	protected readonly rideIntentOptions = resource<string[], unknown>({
		defaultValue: [],
		loader: async () => {
			const buckets = await firstValueFrom(
				this._facade.getDistribution({ dimension: 'RIDE_INTENT' }),
			);
			return buckets.map((bucket) => bucket.value);
		},
	});

	protected readonly trafficConditionOptions = resource<string[], unknown>({
		defaultValue: [],
		loader: async () => {
			const buckets = await firstValueFrom(
				this._facade.getDistribution({ dimension: 'TRAFFIC_CONDITION' }),
			);
			return buckets.map((bucket) => bucket.value).filter((value) => value !== 'UNKNOWN');
		},
	});

	protected readonly matchedOverlayCollection = resource<
		SegmentsGeoJson | undefined,
		string | undefined
	>({
		params: () => {
			if (!this.matchedOverlayActive()) {
				return undefined;
			}
			return [
				this.selectedYear() ?? '',
				[...this.selectedEnrichmentFilters()].sort().join(','),
				this.selectedRideIntent() ?? '',
				this.selectedTrafficCondition() ?? '',
			].join('|');
		},
		loader: async ({ params }) => {
			const [year, filters, rideIntent, trafficCondition] = params.split('|');
			return firstValueFrom(
				this._facade.getSegmentsGeoJson({
					minAvoidanceRatio: 0,
					minPreferenceRatio: 0,
					minSampleSize: 1,
					limit: 10000,
					...this.yearRange(year ? Number(year) : undefined),
					enrichmentFilters: this.enrichmentFiltersParam(
						filters ? (filters.split(',') as SegmentEnrichmentFilter[]) : [],
					),
					rideIntent: rideIntent || undefined,
					trafficCondition: trafficCondition || undefined,
				}),
			);
		},
	});

	private readonly matchedOverlayFeatures = computed<GeoJSON.Feature<LineString>[]>(() => {
		const collection = this.matchedOverlayCollection.value();
		if (!this.matchedOverlayActive() || !collection) {
			return [];
		}

		return collection.features.map(
			(feature): GeoJSON.Feature<LineString> => ({
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
			}),
		);
	});

	protected readonly filteredSegments = computed(() => this.segmentPool.value() ?? []);

	protected readonly analyticsFilters = computed<AnalyticsFilters>(() => ({
		...this.yearRange(this.selectedYear()),
		rideIntent: this.selectedRideIntent(),
	}));

	protected readonly yearOptions = computed<number[]>(() => {
		const summary = this.summaryStats.value();
		if (!summary?.latestEventTimestamp) {
			return [];
		}

		const earliestYear = Math.max(
			minSelectableEventYear,
			summary.earliestEventTimestamp
				? new Date(summary.earliestEventTimestamp).getUTCFullYear()
				: minSelectableEventYear,
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

	protected readonly inspectorIdentity = computed<
		{ primary: string; secondary: string } | undefined
	>(() => {
		const segment = this.selectedSegment();
		if (!segment) {
			return undefined;
		}

		const streetName = segment.streetName || 'Unknown street';
		const address = this.selectedSegmentAddress.value();
		return {
			primary: address ? `${streetName}, ${address}` : streetName,
			secondary: `Segment ${segment.id}`,
		};
	});

	protected readonly segmentInfoMetrics = computed<DetailMetric[]>(() => {
		const segment = this.selectedSegment();
		if (!segment) {
			return [];
		}

		return [
			{ label: 'Avoidance events', value: this.formatNumber(segment.avoidanceCount) },
			{ label: 'Preference events', value: this.formatNumber(segment.preferenceCount) },
			{ label: 'Observations', value: this.formatNumber(segment.totalObservationCount) },
			{ label: 'Avoidance ratio', value: this.formatPercent(segment.avoidanceRatio) },
			{ label: 'Preference ratio', value: this.formatPercent(segment.preferenceRatio) },
			{
				label: 'Gradient',
				value:
					segment?.gradientPercent === null || segment?.gradientPercent === undefined
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
			this.topContext(events, 'highway', 'Road/path type'),
			this.topContext(events, 'cyclewayType', 'Cycling facility', (value) =>
				this.cyclewayTypeLabel(value),
			),
			this.topContext(events, 'cyclewayLocation', 'Position', (value) =>
				this.cyclewayLocationLabel(value),
			),
			this.topContext(events, 'cyclewaySurface', 'Facility surface'),
			this.topContext(events, 'surface', 'Surface'),
			this.topContext(events, 'smoothness', 'Smoothness'),
			this.topContext(events, 'lit', 'Lighting'),
			this.topContext(events, 'bicycleOneway', 'Cycling direction', (value) =>
				this.cyclingDirectionLabel(value),
			),
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

		// the map panel is hidden (not destroyed) on other tabs; resize on return
		// in case the hidden absolute panel tracked a different sibling height
		effect(() => {
			if (this.selectedTab() === 'MAP') {
				const map = this._map();
				requestAnimationFrame(() => map?.resize());
			}
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
			const segmentFilteringActive = this.segmentFiltersActive();
			if (
				!selectedId ||
				!segmentFilteringActive ||
				this._selectionPinned() ||
				this.segmentPool.isLoading()
			) {
				return;
			}

			const tileProperties = this._selectedSegmentTileProperties();
			const selectedSegmentVisible =
				this.filteredSegments().some((segment) => segment.id === selectedId) ||
				this.matchedOverlayFeatures().some(
					(feature) => feature.properties?.['id'] === selectedId,
				) ||
				(!this.matchedOverlayActive() &&
					tileProperties !== undefined &&
					this.tilePropertiesMatchFilters(tileProperties, filters, this.selectedYear()));
			if (!selectedSegmentVisible) {
				this.selectSegment(undefined);
			}
		});

		effect(() => {
			const map = this._map();
			this._trafficDetectorFeatures = this.showTrafficSensors()
				? this.trafficDetectorFeatures()
				: [];
			if (map) {
				this.syncTrafficDetectorSource(map);
			}
		});

		effect(() => {
			const map = this._map();
			this._nearMissIncidentFeatures = this.showNearMissIncidents()
				? this.nearMissIncidentFeatures()
				: [];
			// dots may disappear under an open popup when the year filter changes
			this.closeNearMissIncidentPopup();
			if (map) {
				this.syncNearMissIncidentSource(map);
			}
		});

		effect(() => {
			const map = this._map();
			this._roadClosureFeatures = this.showRoadClosures() ? this.roadClosureFeatures() : [];
			this.closeRoadClosurePopup();
			if (map) {
				this.syncRoadClosureSource(map);
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
				void this.applyHoverHighlight(
					map,
					hoveredId,
					() =>
						this.hoveredSegmentId() === hoveredId &&
						this.selectedSegmentId() !== hoveredId,
				);
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
		map.addControl(
			new MapBaseStyleControl(
				this.mapBaseStyleOptions,
				() => this.selectedMapBaseStyle(),
				(style) => this.onMapBaseStyleChange(style),
			),
			'top-left',
		);
		this._map.set(map);
	}

	protected onSegmentEventsToggle(visible: boolean): void {
		this.showSegmentEvents.set(visible);
	}

	protected onClearAllFilters(): void {
		this.selectedYear.set(undefined);
		this.onPropertyFiltersClear();
		this.onEnrichmentFiltersClear();
		this.onRiskLegendClear();
		this.clearSelectedCorridor(this._map());
	}

	protected onResetMapView(): void {
		this._map()?.jumpTo({ center: berlinMapCenter, zoom: berlinMapZoom });
	}

	protected onConditionRowToggle(label: string): void {
		this.expandedConditionGroup.update((expanded) => (expanded === label ? undefined : label));
	}

	protected onTechnicalDetailsToggle(): void {
		this.showTechnicalDetails.update((shown) => !shown);
	}

	protected onTabChange(tab: ExplorerTab): void {
		if (
			this.selectedTab() === 'ROUTE_COMPARISONS' &&
			tab !== 'ROUTE_COMPARISONS' &&
			this.routeReviewDirty()
		) {
			this.pendingTab.set(tab);
			return;
		}
		this.selectedTab.set(tab);
	}

	protected keepRouteReviewOpen(): void {
		this.pendingTab.set(undefined);
	}

	protected discardRouteReviewAndSwitchTab(): void {
		const tab = this.pendingTab();
		this.pendingTab.set(undefined);
		this.routeReviewDirty.set(false);
		if (tab) {
			this.selectedTab.set(tab);
		}
	}

	protected onTableRowSelected(segmentId: number): void {
		this.clearCorridorUnlessMember(segmentId, this._map());
		this.selectedTab.set('MAP');
		// wait a frame so the map panel has left its hidden state before flying
		requestAnimationFrame(() => {
			this._map()?.resize();
			void this.flyToSegment(segmentId);
		});
	}

	protected onViewCorridorOnMap(street: CorridorRanking): void {
		this.selectedTab.set('MAP');
		const requestVersion = ++this._corridorRequestVersion;
		this._corridorGeometryFeature = undefined;
		this.selectedCorridorSegmentIds.set(street.segmentIds ?? []);
		const map = this._map();
		if (map) {
			this.syncCorridorHighlight(map);
		}
		if (street.topSegmentId != null) {
			this.selectSegment(street.topSegmentId);
			// the street's top segment came from the analytics filters, not the
			// segment pool, so keep it selected even if it is outside the pool
			this._selectionPinned.set(true);
		}

		if (
			street.minLon == null ||
			street.minLat == null ||
			street.maxLon == null ||
			street.maxLat == null
		) {
			return;
		}
		void this.loadCorridorGeometry(street, requestVersion);

		if (!map) {
			return;
		}

		const bounds: [[number, number], [number, number]] = [
			[street.minLon, street.minLat],
			[street.maxLon, street.maxLat],
		];
		requestAnimationFrame(() => {
			map.resize();
			map.fitBounds(bounds, { padding: 80, maxZoom: 16, duration: 800 });
		});
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
		const bounds = coordinates.reduce(
			(currentBounds, coordinate) => {
				return currentBounds.extend(coordinate as [number, number]);
			},
			new maplibregl.LngLatBounds(
				coordinates[0] as [number, number],
				coordinates[0] as [number, number],
			),
		);

		map.fitBounds(bounds, { padding: 80, maxZoom: 16, duration: 800 });

		this.setSelectedHighlight(map, segment.geometry, segment);
	}

	protected onYearChange(year: number | undefined): void {
		this.clearSelectedCorridor(this._map());
		this.selectedYear.set(year);
	}

	protected onRideIntentChange(rideIntent: string | undefined): void {
		this.clearSelectedCorridor(this._map());
		this.selectedRideIntent.set(rideIntent);
	}

	protected onPropertyFiltersClear(): void {
		this.selectedRideIntent.set(undefined);
		this.selectedTrafficCondition.set(undefined);
	}

	protected onEventFilterChange(value: string): void {
		this.selectedEventId.set(undefined);
		this.selectedInfoPopoverId.set(undefined);
		this.selectedEventFilter.set(value as EventFilter);
	}

	protected onEnrichmentChipToggle(filter: SegmentEnrichmentFilter): void {
		this.selectedEnrichmentFilters.update((selectedFilters) => {
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

	protected isEnrichmentChipSelected(filter: SegmentEnrichmentFilter): boolean {
		return this.selectedEnrichmentFilters().includes(filter);
	}

	protected onEnrichmentFiltersClear(): void {
		this.selectedEnrichmentFilters.set([]);
		this.selectSegment(undefined);
		const map = this._map();
		if (map) {
			this.clearHighlight(map);
		}
	}

	protected onRiskLegendToggle(bucket: RiskLegendBucket): void {
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

	protected isRiskLegendSelected(bucket: RiskLegendBucket): boolean {
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
		this.selectedEventId.update((selectedEventId) =>
			selectedEventId === eventId ? undefined : eventId,
		);
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
		this.selectedInfoPopoverId.update((selectedInfoId) =>
			selectedInfoId === infoId ? undefined : infoId,
		);
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
			this.eventChip(
				'Cycleway',
				this.cyclewayTypeLabel(event.cyclewayType),
				'infrastructure',
			),
			this.eventChip('Path', event.highway, 'infrastructure'),
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
			this.eventDetailItem('Purpose', event.rideIntent),
			this.eventDetailItem('Bike type', event.bikeType),
		]).items;
	}

	protected eventConditionRows(event: SegmentEvent): ConditionRow[] {
		const rows: (ConditionRow | undefined)[] = [
			event.weatherEnriched
				? {
						label: 'Weather',
						icon: 'ph-cloud-rain',
						tone: 'blue',
						summary: this.eventWeatherSummary(event) ?? 'Weather data recorded',
						items: this.eventDetailGroup('Weather', [
							this.eventDetailItem('Temperature', event.temperature2m, {
								suffix: '°C',
							}),
							this.eventDetailItem('Precipitation', event.precipitation, {
								suffix: ' mm',
							}),
							this.eventDetailItem('Wind exposure', event.windExposure),
							this.eventDetailItem('Wind speed', event.windSpeed10m, {
								suffix: ' km/h',
							}),
							this.eventDetailItem(
								'Weather code',
								this.formatWeatherCode(event.weatherCode),
								{
									formatBucket: false,
									infoId: `${event.id}-weather-code`,
									infoUrl:
										'https://open-meteo.com/en/docs#weather_variable_documentation',
								},
							),
						]).items,
					}
				: undefined,
			event.ohsomeEnriched ? this.infrastructureConditionRow(event) : undefined,
			event.trafficEnriched
				? {
						label: 'Traffic',
						icon: 'ph-traffic-signal',
						tone: 'orange',
						summary: this.eventTrafficSummary(event) ?? 'Traffic data recorded',
						items: this.eventDetailGroup('Traffic', [
							this.eventDetailItem('Condition', event.trafficCondition),
							this.eventDetailItem('Motor vehicle volume', event.trafficVolumeKfz, {
								suffix: ' vehicles',
							}),
							this.eventDetailItem('Motor vehicle speed', event.trafficSpeedKfz, {
								suffix: ' km/h',
							}),
							this.eventDetailItem('Car volume', event.trafficVolumePkw, {
								suffix: ' cars',
							}),
							this.eventDetailItem('Car speed', event.trafficSpeedPkw, {
								suffix: ' km/h',
							}),
							this.eventDetailItem('Truck volume', event.trafficVolumeLkw, {
								suffix: ' trucks',
							}),
							this.eventDetailItem('Truck speed', event.trafficSpeedLkw, {
								suffix: ' km/h',
							}),
						]).items,
					}
				: undefined,
			this.roadDisruptionConditionRow(event),
		];
		return rows.filter(
			(row): row is ConditionRow =>
				row !== undefined && (row.items.length > 0 || (row.detailGroups?.length ?? 0) > 0),
		);
	}

	protected technicalDetailItems(event: SegmentEvent): EventDetailItem[] {
		return [
			event.trafficEnriched
				? this.eventDetailItem('Traffic status', event.trafficEnrichmentStatus)
				: undefined,
			event.trafficEnriched
				? this.eventDetailItem('Traffic source type', event.trafficSourceType)
				: undefined,
		].filter((item): item is EventDetailItem => item !== undefined);
	}

	private eventWeatherSummary(event: SegmentEvent): string | undefined {
		const windSpeed = this.formatContextValue(event.windSpeed10m, ' km/h');
		const parts = [
			this.weatherCodeSummary(event.weatherCode),
			this.formatContextValue(event.temperature2m, '°C'),
			windSpeed ? `Wind ${windSpeed}` : undefined,
		].filter((part): part is string => part !== undefined);
		return parts.length ? parts.join(' · ') : undefined;
	}

	private eventTrafficSummary(event: SegmentEvent): string | undefined {
		const parts = [
			this.formatContextValue(event.trafficCondition),
			this.formatContextValue(event.trafficVolumeKfz, ' vehicles'),
			this.formatContextValue(event.trafficSpeedKfz, ' km/h'),
		].filter((part): part is string => part !== undefined);
		return parts.length ? parts.join(' · ') : undefined;
	}

	private infrastructureConditionRow(event: SegmentEvent): ConditionRow | undefined {
		const pathItems = [
			this.eventDetailItem('Road/path type', event.highway),
			this.eventDetailItem('Surface', event.surface),
			this.eventDetailItem('Smoothness', event.smoothness),
			this.eventDetailItem('Lighting', event.lit),
		].filter((item): item is EventDetailItem => item !== undefined);
		const cyclingItems = [
			this.eventDetailItem('Cycling facility', this.cyclewayTypeLabel(event.cyclewayType)),
			this.eventDetailItem('Position', this.cyclewayLocationLabel(event.cyclewayLocation)),
			this.eventDetailItem('Facility surface', event.cyclewaySurface),
			this.eventDetailItem('Width', event.cyclewayWidth, { suffix: ' m' }),
			this.eventDetailItem(
				'Cycling direction',
				this.cyclingDirectionLabel(event.bicycleOneway),
			),
		].filter((item): item is EventDetailItem => item !== undefined);
		const noDedicatedFacility = this.noDedicatedCyclingFacilityRecorded(event)
			? 'No dedicated cycling facility recorded'
			: undefined;
		const detailGroupCandidates: (ConditionDetailGroup | undefined)[] = [
			pathItems.length
				? {
						id: `${event.id}-path-characteristics`,
						label: 'Path characteristics',
						tone: 'green',
						items: pathItems,
					}
				: undefined,
			cyclingItems.length || noDedicatedFacility
				? {
						id: `${event.id}-cycling-facility`,
						label: 'Cycling facility',
						tone: 'green',
						items: cyclingItems,
						description: noDedicatedFacility,
					}
				: undefined,
		];
		const detailGroups = detailGroupCandidates.filter(
			(group): group is ConditionDetailGroup => group !== undefined,
		);

		if (!detailGroups.length) {
			return undefined;
		}

		return {
			label: 'Infrastructure',
			icon: 'ph-bicycle',
			tone: 'green',
			summary: this.eventInfrastructureSummary(event) ?? 'Infrastructure attributes recorded',
			items: [],
			detailGroups,
		};
	}

	private eventInfrastructureSummary(event: SegmentEvent): string | undefined {
		const facilityType = this.cyclewayTypeLabel(event.cyclewayType);
		const parts = facilityType
			? [facilityType, this.cyclewayLocationLabel(event.cyclewayLocation)]
			: [this.formatContextValue(event.highway), this.formatContextValue(event.surface)];
		const meaningfulParts = parts.filter((part): part is string => part !== undefined);
		if (meaningfulParts.length) {
			return meaningfulParts.join(' · ');
		}
		return this.noDedicatedCyclingFacilityRecorded(event)
			? 'No dedicated cycling facility recorded'
			: undefined;
	}

	private cyclewayTypeLabel(value: string | undefined): string | undefined {
		if (
			!value ||
			omittedContextValues.has(value.toUpperCase()) ||
			value.toUpperCase() === 'NO'
		) {
			return undefined;
		}
		return cyclewayTypeLabels[value.toUpperCase()] ?? this.formatContextValue(value);
	}

	private cyclewayLocationLabel(value: string | undefined): string | undefined {
		if (!value || omittedContextValues.has(value.toUpperCase())) {
			return undefined;
		}
		return cyclewayLocationLabels[value.toUpperCase()] ?? this.formatContextValue(value);
	}

	private cyclingDirectionLabel(value: boolean | undefined): string | undefined {
		if (value === null || value === undefined) {
			return undefined;
		}
		return value ? 'One-way' : 'Two-way';
	}

	private noDedicatedCyclingFacilityRecorded(event: SegmentEvent): boolean {
		const facilityRecorded =
			this.cyclewayTypeLabel(event.cyclewayType) !== undefined ||
			this.cyclewayLocationLabel(event.cyclewayLocation) !== undefined ||
			this.formatContextValue(event.cyclewaySurface) !== undefined ||
			(event.cyclewayWidth !== null && event.cyclewayWidth !== undefined);
		if (facilityRecorded) {
			return false;
		}
		const explicitlyAbsent =
			event.cyclewayType?.toUpperCase() === 'NO' ||
			event.cyclewayLocation?.toUpperCase() === 'NONE';
		return explicitlyAbsent && event.highway?.toUpperCase() !== 'CYCLEWAY';
	}

	private roadDisruptionConditionRow(event: SegmentEvent): ConditionRow | undefined {
		const disruptions = event.roadDisruptions ?? [];
		if (!disruptions.length) {
			return undefined;
		}

		const firstDisruption = disruptions[0];
		return {
			label: 'Road disruption',
			icon: 'ph-warning',
			tone: 'red',
			summary:
				disruptions.length === 1
					? this.roadDisruptionSummary(firstDisruption)
					: `${disruptions.length} disruptions`,
			items: [],
			detailGroups: disruptions.map((disruption, index) =>
				this.roadDisruptionDetailGroup(disruption, index),
			),
		};
	}

	private roadDisruptionDetailGroup(
		disruption: ExternalFactor,
		index: number,
	): ConditionDetailGroup {
		const severity = this.roadDisruptionMetadata(disruption, 'severity');
		const externalId = this.roadDisruptionMetadata(disruption, 'id');
		return {
			id: externalId ?? `${disruption.factorType}-${disruption.validFrom ?? index}-${index}`,
			label: this.roadDisruptionTypeLabel(disruption.factorType),
			tone: 'red',
			items: [
				this.eventDetailItem(
					'Severity',
					severity ? roadClosureSeverityLabels[severity] || severity : undefined,
					{ formatBucket: false },
				),
				this.eventDetailItem(
					'Direction',
					this.roadDisruptionMetadata(disruption, 'direction'),
					{
						formatBucket: false,
					},
				),
				this.eventDetailItem(
					'Active from',
					disruption.validFrom == null
						? undefined
						: this.formatDateTime(disruption.validFrom),
					{ formatBucket: false },
				),
				this.eventDetailItem(
					'Active until',
					disruption.validTo == null
						? 'Ongoing'
						: this.formatDateTime(disruption.validTo),
					{ formatBucket: false },
				),
				this.eventDetailItem('Street', this.roadDisruptionMetadata(disruption, 'street'), {
					formatBucket: false,
					wide: true,
				}),
				this.eventDetailItem(
					'Section',
					this.roadDisruptionMetadata(disruption, 'section'),
					{
						formatBucket: false,
						wide: true,
					},
				),
				this.eventDetailItem(
					'Description',
					this.roadDisruptionMetadata(disruption, 'content'),
					{
						formatBucket: false,
						wide: true,
					},
				),
			].filter((item): item is EventDetailItem => item !== undefined),
		};
	}

	private roadDisruptionSummary(disruption: ExternalFactor): string {
		return this.roadDisruptionTypeLabel(disruption.factorType);
	}

	private roadDisruptionMetadata(disruption: ExternalFactor, key: string): string | undefined {
		const value = disruption.metadata?.[key];
		return typeof value === 'string' || typeof value === 'number' ? String(value) : undefined;
	}

	private roadDisruptionTypeLabel(factorType: string): string {
		return roadClosureTypeLabels[factorType] ?? this.formatValue(factorType);
	}

	private ensureMapLayers(map: maplibregl.Map, generatedAt: number): void {
		if (map.getSource(preferenceAvoidanceSegmentsSource)) {
			return;
		}

		map.addSource(preferenceAvoidanceSegmentsSource, {
			type: 'vector',
			url: this.tileUrl(generatedAt),
		});

		const corridorPaint: maplibregl.LineLayerSpecification['paint'] = {
			'line-color': '#2563eb',
			'line-width': ['interpolate', ['linear'], ['zoom'], 6, 6, 12, 10, 16, 14],
			'line-opacity': 0.58,
			'line-blur': 0.8,
		};
		map.addLayer({
			id: preferenceAvoidanceCorridorStreetsLayer,
			type: 'line',
			source: preferenceAvoidanceSegmentsSource,
			'source-layer': 'streets',
			maxzoom: segmentDetailMinZoom + segmentLayerTransitionZoom,
			layout: { visibility: 'none' },
			paint: corridorPaint,
		});
		map.addLayer({
			id: preferenceAvoidanceCorridorSegmentsLayer,
			type: 'line',
			source: preferenceAvoidanceSegmentsSource,
			'source-layer': 'segments',
			minzoom: segmentDetailMinZoom - segmentLayerTransitionZoom,
			layout: { visibility: 'none' },
			paint: corridorPaint,
		});
		map.addSource(preferenceAvoidanceCorridorGeometrySource, {
			type: 'geojson',
			data: { type: 'FeatureCollection', features: [] },
		});
		map.addLayer({
			id: preferenceAvoidanceCorridorGeometryLayer,
			type: 'line',
			source: preferenceAvoidanceCorridorGeometrySource,
			layout: { visibility: 'none' },
			paint: corridorPaint,
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

		const hoverAwareOpacity = (
			selectedOpacity: number,
			hoverOpacity: number,
		): maplibregl.ExpressionSpecification => [
			'case',
			['==', ['get', 'highlightKind'], 'hover'],
			hoverOpacity,
			selectedOpacity,
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
		map.addSource(nearMissIncidentsSource, {
			type: 'geojson',
			data: { type: 'FeatureCollection', features: [] },
		});
		map.addLayer({
			id: nearMissIncidentsLayer,
			type: 'circle',
			source: nearMissIncidentsSource,
			paint: {
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 3, 14, 5.5],
				'circle-color': nearMissIncidentColor,
				'circle-stroke-color': nearMissIncidentStrokeColor,
				'circle-stroke-width': 1.25,
				'circle-opacity': 0.9,
			},
		});
		this.ensureRoadClosureWarningImage(map);
		map.addSource(roadClosuresSource, {
			type: 'geojson',
			data: { type: 'FeatureCollection', features: [] },
		});
		map.addLayer({
			id: roadClosuresLineLayer,
			type: 'line',
			source: roadClosuresSource,
			filter: ['==', ['geometry-type'], 'LineString'],
			layout: {
				'line-cap': 'round',
			},
			paint: {
				'line-color': roadClosureColor,
				'line-width': 2.5,
				'line-dasharray': [0.1, 1.8],
			},
		});
		map.addLayer({
			id: roadClosuresPointLayer,
			type: 'circle',
			source: roadClosuresSource,
			filter: [
				'all',
				['==', ['geometry-type'], 'Point'],
				['==', ['get', 'marker'], 'circle'],
			],
			paint: {
				'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 14, 7],
				'circle-color': '#ffffff',
				'circle-stroke-color': roadClosureColor,
				'circle-stroke-width': 2,
			},
		});
		map.addLayer({
			id: roadClosuresSymbolLayer,
			type: 'symbol',
			source: roadClosuresSource,
			filter: [
				'all',
				['==', ['geometry-type'], 'Point'],
				['==', ['get', 'marker'], 'warning'],
			],
			layout: {
				'icon-image': roadClosureWarningImageId,
				'icon-size': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 14, 1],
				'icon-allow-overlap': true,
			},
		});

		this.applyMapFilters(map);
		this.syncCorridorHighlight(map);
		this.syncHighlightSource(map);
		this.syncMatchedSource(map);
		this.syncTrafficDetectorSource(map);
		this.syncTrafficDetectorRadiusSource(map);
		this.syncNearMissIncidentSource(map);
		this.syncRoadClosureSource(map);

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
			nearMissIncidentsLayer,
			roadClosuresLineLayer,
			roadClosuresPointLayer,
			roadClosuresSymbolLayer,
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

			this.clearCorridorUnlessMember(segmentId, map);
			this.selectSegment(segmentId);
			this._selectedSegmentTileProperties.set(properties);
			this.setSelectedHighlight(
				map,
				feature.geometry as LineString | MultiLineString,
				properties,
			);
		};
		map.on('click', preferenceAvoidanceStreetsLayer, onTileSegmentClick);
		map.on('click', preferenceAvoidanceSegmentsLayer, onTileSegmentClick);

		map.on('click', preferenceAvoidanceMatchedLayer, (event) => {
			const feature = event.features?.[0];
			const segmentId = Number(feature?.properties?.['id']);
			if (!feature || !Number.isFinite(segmentId)) {
				return;
			}

			this.clearCorridorUnlessMember(segmentId, map);
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

		map.on('click', nearMissIncidentsLayer, (event) => {
			const feature = event.features?.[0];
			if (feature) {
				this.openNearMissIncidentPopup(map, feature);
			}
		});

		for (const layerId of [
			roadClosuresLineLayer,
			roadClosuresPointLayer,
			roadClosuresSymbolLayer,
		]) {
			map.on('click', layerId, (event) => {
				const feature = event.features?.[0];
				if (feature) {
					this.openRoadClosurePopup(map, feature, event.lngLat);
				}
			});
		}

		map.on('click', (event) => {
			const clickableLayers = interactiveLayers.filter((layerId) => map.getLayer(layerId));
			if (!clickableLayers.length) {
				return;
			}

			const features = map.queryRenderedFeatures(event.point, { layers: clickableLayers });
			const segmentFeature = features.find(
				(feature) =>
					feature.layer.id === preferenceAvoidanceStreetsLayer ||
					feature.layer.id === preferenceAvoidanceSegmentsLayer ||
					feature.layer.id === preferenceAvoidanceMatchedLayer,
			);
			const clickedSegmentId = Number(segmentFeature?.properties?.['id']);
			if (
				this.selectedCorridorSegmentIds().length &&
				(!Number.isFinite(clickedSegmentId) ||
					!this.isSelectedCorridorSegment(clickedSegmentId))
			) {
				this.clearSelectedCorridor(map);
			}
			if (features.length === 0) {
				this.selectSegment(undefined);
				this.clearHighlight(map);
				this.clearTrafficDetectorSelection(map);
				this.closeNearMissIncidentPopup();
				this.closeRoadClosurePopup();
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
		const normalized = (apiUrl ?? '')
			.trim()
			.replace(/\/+$/, '')
			.replace(/\/api$/i, '');
		if (
			!normalized ||
			normalized.startsWith('/') ||
			/^[a-z][a-z\d+\-.]*:\/\//i.test(normalized)
		) {
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
				eventBalance: calculateEventBalance(
					segment.avoidanceCount,
					segment.preferenceCount,
				),
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

	protected onNearMissIncidentsToggle(): void {
		const enabled = !this.showNearMissIncidents();
		this.showNearMissIncidents.set(enabled);
		if (!enabled) {
			this.closeNearMissIncidentPopup();
		}
	}

	protected onRoadClosuresToggle(): void {
		const enabled = !this.showRoadClosures();
		this.showRoadClosures.set(enabled);
		if (!enabled) {
			this.closeRoadClosurePopup();
		}
	}

	private selectTrafficDetector(
		map: maplibregl.Map,
		feature: maplibregl.MapGeoJSONFeature,
	): void {
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
		const popupCoordinate = this.trafficDetectorPopupCoordinate(
			map,
			this._trafficDetectorRadiusFeature.geometry,
			[lon, lat],
		);
		this.openTrafficDetectorPopup(map, popupCoordinate, properties, radiusMeters);
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
		popupCoordinate: [number, number],
		properties: Record<string, unknown>,
		radiusMeters: number,
	): void {
		this._trafficDetectorPopup?.remove();

		const text = (key: string) => this.escapeHtml(String(properties[key] ?? ''));
		const laneCount = Number(properties['laneCount'] ?? 0);
		const activeLaneCount = Number(properties['activeLaneCount'] ?? 0);
		const activeFrom = String(properties['activeFrom'] ?? '');
		const activeTo = String(properties['activeTo'] ?? '');
		const activePeriod =
			activeFrom || activeTo
				? `${this.escapeHtml(activeFrom || '?')} – ${activeTo ? this.escapeHtml(activeTo) : 'today'}`
				: '';
		const rows = [
			['Direction', text('directions')],
			['Lane detectors', `${activeLaneCount} of ${laneCount} active`],
			['Active period', activePeriod],
			['Match radius', `${radiusMeters} m`],
			['Detectors', text('detectorNames')],
		].filter(([, value]) => value);

		const popup = new maplibregl.Popup({
			anchor: 'top',
			closeButton: true,
			closeOnClick: false,
			maxWidth: '320px',
			offset: [0, 12],
		})
			.setLngLat(popupCoordinate)
			.setHTML(
				`
				<div class="detector-popup">
					<h4>${text('street') || 'Traffic sensor'}</h4>
					${properties['position'] ? `<p>${text('position')}${properties['positionDetail'] ? ` · ${text('positionDetail')}` : ''}</p>` : ''}
					<dl>
						${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}
					</dl>
				</div>
			`,
			)
			.addTo(map);
		popup.on('close', () => {
			if (this._trafficDetectorPopup === popup) {
				this._trafficDetectorPopup = undefined;
				this.clearTrafficDetectorSelection(map);
			}
		});
		this._trafficDetectorPopup = popup;
	}

	private trafficDetectorPopupCoordinate(
		map: maplibregl.Map,
		geometry: Polygon,
		fallback: [number, number],
	): [number, number] {
		const boundary = geometry.coordinates[0];
		if (!boundary?.length) {
			return fallback;
		}

		return boundary.reduce<[number, number]>(
			(lowestCoordinate, coordinate) => {
				const candidate = coordinate as [number, number];
				return map.project(candidate).y > map.project(lowestCoordinate).y
					? candidate
					: lowestCoordinate;
			},
			boundary[0] as [number, number],
		);
	}

	private openNearMissIncidentPopup(
		map: maplibregl.Map,
		feature: maplibregl.MapGeoJSONFeature,
	): void {
		this._nearMissIncidentPopup?.remove();

		const properties = feature.properties ?? {};
		const [lon, lat] = (feature.geometry as Point).coordinates;
		const typeKey = String(properties['incidentType'] ?? '');
		const typeLabel = nearMissIncidentTypeLabels[typeKey] ?? 'Near-miss incident';
		const timestamp = Number(properties['timestamp'] ?? 0);
		const participants = String(properties['participants'] ?? '')
			.split(',')
			.filter(Boolean)
			.map((participant) => this.formatValue(participant))
			.join(', ');
		const description = String(properties['description'] ?? '');
		const rows = [
			['When', timestamp ? this.formatDateTime(timestamp) : ''],
			['Involved', this.escapeHtml(participants)],
		].filter(([, value]) => value);

		const popup = new maplibregl.Popup({
			closeButton: true,
			closeOnClick: false,
			maxWidth: '320px',
		})
			.setLngLat([lon, lat])
			.setHTML(
				`
				<div class="detector-popup">
					<h4>${this.escapeHtml(typeLabel)}</h4>
					<dl>
						${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}
					</dl>
					${description ? `<p>${this.escapeHtml(description)}</p>` : ''}
				</div>
			`,
			)
			.addTo(map);
		popup.on('close', () => {
			if (this._nearMissIncidentPopup === popup) {
				this._nearMissIncidentPopup = undefined;
			}
		});
		this._nearMissIncidentPopup = popup;
	}

	private closeNearMissIncidentPopup(): void {
		const popup = this._nearMissIncidentPopup;
		this._nearMissIncidentPopup = undefined;
		popup?.remove();
	}

	private openRoadClosurePopup(
		map: maplibregl.Map,
		feature: maplibregl.MapGeoJSONFeature,
		lngLat: maplibregl.LngLat,
	): void {
		this._roadClosurePopup?.remove();

		const properties = feature.properties ?? {};
		const text = (key: string) => String(properties[key] ?? '');
		const typeLabel = roadClosureTypeLabels[text('factorType')] ?? 'Road closure';
		const severityLabel = roadClosureSeverityLabels[text('severity')] ?? '';
		const validFrom = Number(properties['validFrom'] ?? 0);
		const validTo = Number(properties['validTo'] ?? 0);
		const period = validFrom
			? `${this.formatDateTime(validFrom)} – ${validTo ? this.formatDateTime(validTo) : 'open-ended'}`
			: '';
		const rows = [
			['Type', this.escapeHtml(typeLabel)],
			['Severity', this.escapeHtml(severityLabel)],
			['Direction', this.escapeHtml(text('direction'))],
			['Period', this.escapeHtml(period)],
		].filter(([, value]) => value);

		const popup = new maplibregl.Popup({
			closeButton: true,
			closeOnClick: false,
			maxWidth: '320px',
		})
			.setLngLat(lngLat)
			.setHTML(
				`
				<div class="detector-popup">
					<h4>${this.escapeHtml(text('street') || typeLabel)}</h4>
					${properties['section'] ? `<p>${this.escapeHtml(text('section'))}</p>` : ''}
					<dl>
						${rows.map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('')}
					</dl>
					${properties['content'] ? `<p>${this.escapeHtml(text('content'))}</p>` : ''}
				</div>
			`,
			)
			.addTo(map);
		popup.on('close', () => {
			if (this._roadClosurePopup === popup) {
				this._roadClosurePopup = undefined;
			}
		});
		this._roadClosurePopup = popup;
	}

	private closeRoadClosurePopup(): void {
		const popup = this._roadClosurePopup;
		this._roadClosurePopup = undefined;
		popup?.remove();
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
		const source = map.getSource(trafficDetectorsSource) as
			| maplibregl.GeoJSONSource
			| undefined;
		if (!source) {
			return;
		}
		source.setData({ type: 'FeatureCollection', features: this._trafficDetectorFeatures });
	}

	private syncTrafficDetectorRadiusSource(map: maplibregl.Map): void {
		const source = map.getSource(trafficDetectorRadiusSource) as
			| maplibregl.GeoJSONSource
			| undefined;
		if (!source) {
			return;
		}
		const features = this._trafficDetectorRadiusFeature
			? [this._trafficDetectorRadiusFeature]
			: [];
		source.setData({ type: 'FeatureCollection', features });
	}

	private syncNearMissIncidentSource(map: maplibregl.Map): void {
		const source = map.getSource(nearMissIncidentsSource) as
			| maplibregl.GeoJSONSource
			| undefined;
		if (!source) {
			return;
		}
		source.setData({ type: 'FeatureCollection', features: this._nearMissIncidentFeatures });
	}

	private syncRoadClosureSource(map: maplibregl.Map): void {
		const source = map.getSource(roadClosuresSource) as maplibregl.GeoJSONSource | undefined;
		if (!source) {
			return;
		}
		source.setData({ type: 'FeatureCollection', features: this._roadClosureFeatures });
	}

	/**
	 * Registers the red warning-triangle marker for closure points. Base style
	 * switches wipe all images, so ensureMapLayers re-invokes this after every
	 * style reload; the hasImage guard makes that idempotent.
	 */
	private ensureRoadClosureWarningImage(map: maplibregl.Map): void {
		if (map.hasImage(roadClosureWarningImageId)) {
			return;
		}

		const size = 44;
		const canvas = document.createElement('canvas');
		canvas.width = size;
		canvas.height = size;
		const context = canvas.getContext('2d');
		if (!context) {
			return;
		}

		context.beginPath();
		context.moveTo(size / 2, 3);
		context.lineTo(size - 3, size - 5);
		context.lineTo(3, size - 5);
		context.closePath();
		context.fillStyle = roadClosureColor;
		context.fill();
		context.lineWidth = 3;
		context.strokeStyle = '#ffffff';
		context.lineJoin = 'round';
		context.stroke();

		context.fillStyle = '#ffffff';
		context.font = `bold ${size * 0.5}px sans-serif`;
		context.textAlign = 'center';
		context.textBaseline = 'middle';
		context.fillText('!', size / 2, size * 0.62);

		map.addImage(roadClosureWarningImageId, context.getImageData(0, 0, size, size), {
			pixelRatio: 2,
		});
	}

	private syncMatchedSource(map: maplibregl.Map): void {
		const source = map.getSource(preferenceAvoidanceMatchedSource) as
			| maplibregl.GeoJSONSource
			| undefined;
		if (!source) {
			return;
		}
		source.setData({ type: 'FeatureCollection', features: this._matchedOverlayFeatures });
	}

	private syncCorridorHighlight(map: maplibregl.Map): void {
		const segmentIds = this.selectedCorridorSegmentIds();
		const completeGeometryVisible = this._corridorGeometryFeature !== undefined;
		const filter: maplibregl.FilterSpecification = segmentIds.length
			? ['in', ['get', 'id'], ['literal', segmentIds]]
			: ['==', ['get', 'id'], -1];
		for (const layerId of [
			preferenceAvoidanceCorridorStreetsLayer,
			preferenceAvoidanceCorridorSegmentsLayer,
		]) {
			if (map.getLayer(layerId)) {
				map.setFilter(layerId, filter);
				map.setLayoutProperty(
					layerId,
					'visibility',
					segmentIds.length && !completeGeometryVisible ? 'visible' : 'none',
				);
			}
		}

		const source = map.getSource(preferenceAvoidanceCorridorGeometrySource) as
			| maplibregl.GeoJSONSource
			| undefined;
		source?.setData({
			type: 'FeatureCollection',
			features: this._corridorGeometryFeature ? [this._corridorGeometryFeature] : [],
		});
		if (map.getLayer(preferenceAvoidanceCorridorGeometryLayer)) {
			map.setLayoutProperty(
				preferenceAvoidanceCorridorGeometryLayer,
				'visibility',
				completeGeometryVisible ? 'visible' : 'none',
			);
		}
	}

	private async loadCorridorGeometry(
		street: CorridorRanking,
		requestVersion: number,
	): Promise<void> {
		try {
			const corridor = await firstValueFrom(
				this._facade.getCorridorGeometry({
					streetName: street.streetName,
					minLon: street.minLon as number,
					minLat: street.minLat as number,
					maxLon: street.maxLon as number,
					maxLat: street.maxLat as number,
				}),
			);
			if (
				requestVersion !== this._corridorRequestVersion ||
				!this.selectedCorridorSegmentIds().length ||
				!corridor.geometry.coordinates.length
			) {
				return;
			}

			this._corridorGeometryFeature = this.corridorGeometryFeature(corridor);
			this.selectedCorridorSegmentIds.set([
				...new Set([...(street.segmentIds ?? []), ...corridor.segmentIds]),
			]);
			const map = this._map();
			if (map) {
				this.syncCorridorHighlight(map);
			}
		} catch {
			// Keep the existing observed-segment highlight as the failure fallback.
		}
	}

	private corridorGeometryFeature(corridor: CorridorGeometry): GeoJSON.Feature<MultiLineString> {
		return {
			type: 'Feature',
			geometry: corridor.geometry,
			properties: { streetName: corridor.streetName },
		};
	}

	private isSelectedCorridorSegment(segmentId: number): boolean {
		return this.selectedCorridorSegmentIds().includes(segmentId);
	}

	private clearCorridorUnlessMember(segmentId: number, map: maplibregl.Map | undefined): void {
		if (
			this.selectedCorridorSegmentIds().length &&
			!this.isSelectedCorridorSegment(segmentId)
		) {
			this.clearSelectedCorridor(map);
		}
	}

	private clearSelectedCorridor(map: maplibregl.Map | undefined): void {
		this._corridorRequestVersion++;
		if (!this.selectedCorridorSegmentIds().length && !this._corridorGeometryFeature) {
			return;
		}
		this.selectedCorridorSegmentIds.set([]);
		this._corridorGeometryFeature = undefined;
		if (map) {
			this.syncCorridorHighlight(map);
		}
	}

	private syncHighlightSource(map: maplibregl.Map): void {
		const source = map.getSource(preferenceAvoidanceHighlightSource) as
			| maplibregl.GeoJSONSource
			| undefined;
		if (!source) {
			return;
		}

		const features = [this._selectedHighlightFeature, this._hoverHighlightFeature].filter(
			(feature): feature is GeoJSON.Feature<LineString | MultiLineString> =>
				feature !== undefined,
		);
		source.setData({ type: 'FeatureCollection', features });
	}

	private applyMapFilters(map: maplibregl.Map): void {
		const year = this.selectedYear();
		const bucketProperty = year !== undefined ? `bucket_${year}` : 'bucket';
		const countProperty = year !== undefined ? `eventCount_${year}` : 'eventCount';

		const clauses: maplibregl.ExpressionSpecification[] = [
			year !== undefined
				? ['>', ['coalesce', ['get', countProperty], 0], 0]
				: [
						'any',
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
				map.setPaintProperty(
					layerId,
					'line-width',
					eventLineWidthExpression(countProperty),
				);
				map.setLayoutProperty(
					layerId,
					'visibility',
					overlayActive || !segmentsVisible ? 'none' : 'visible',
				);
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
					? ([
							'in',
							['get', 'bucket'],
							['literal', selectedBuckets],
						] as maplibregl.FilterSpecification)
					: null,
			);
		}

		// highlight features only carry the legend bucket, so they only follow that filter
		const highlightFilter = selectedBuckets.length
			? ([
					'in',
					['get', 'eventSignalBucket'],
					['literal', selectedBuckets],
				] as maplibregl.FilterSpecification)
			: null;
		[preferenceAvoidanceHighlightOutlineLayer, preferenceAvoidanceHighlightLayer].forEach(
			(layerId) => {
				if (map.getLayer(layerId)) {
					map.setFilter(layerId, highlightFilter);
				}
			},
		);
	}

	private tilePropertiesMatchFilters(
		properties: SegmentTileProperties,
		filters: SegmentEnrichmentFilter[],
		year?: number,
	): boolean {
		const yearEventCount = (properties as unknown as Record<string, unknown>)[
			`eventCount_${year}`
		];
		return (
			(year === undefined || Number(yearEventCount ?? 0) > 0) &&
			filters.every(
				(filter) => Number(properties[enrichmentFilterCountProperty[filter]] ?? 0) > 0,
			)
		);
	}

	private eventSignalColor(segment?: HighlightableSegment): string {
		return RISK_BUCKET_COLORS[this.eventSignalBucket(segment)];
	}

	private eventSignalBucket(segment?: HighlightableSegment): RiskBucket {
		const avoidanceCount = segment?.avoidanceCount ?? 0;
		const preferenceCount = segment?.preferenceCount ?? 0;
		const balance = calculateEventBalance(avoidanceCount, preferenceCount);
		const eventCount = (segment?.avoidanceCount ?? 0) + (segment?.preferenceCount ?? 0);

		return classifyRiskBucket(balance, eventCount);
	}

	private eventLineWidth(
		segment?: Pick<SegmentSummary, 'avoidanceCount' | 'preferenceCount'>,
	): number {
		const events = (segment?.avoidanceCount ?? 0) + (segment?.preferenceCount ?? 0);
		return Math.min(8, Math.max(1.5, 1.5 + Math.log10(events + 1) * 2.2));
	}

	private selectSegment(segmentId: number | undefined): void {
		if (this.selectedSegmentId() !== segmentId) {
			this.selectedEventId.set(undefined);
			this.selectedInfoPopoverId.set(undefined);
			this._selectedSegmentTileProperties.set(undefined);
			this._selectionPinned.set(false);
		}
		this.selectedSegmentId.set(segmentId);
	}

	private enrichmentFiltersParam(
		filters: SegmentEnrichmentFilter[],
	): SegmentEnrichmentFilter[] | undefined {
		return filters.length ? filters : undefined;
	}

	private yearRange(year: number | undefined): { from?: number; to?: number } {
		if (!year) {
			return {};
		}
		return { from: Date.UTC(year, 0, 1), to: Date.UTC(year + 1, 0, 1) - 1 };
	}

	private topContext<T extends keyof SegmentEvent>(
		events: SegmentEvent[],
		key: T,
		label: string,
		formatter?: (value: SegmentEvent[T]) => string | undefined,
	): ContextHighlight | undefined {
		const counts = events.reduce((currentCounts, event) => {
			const rawValue = event[key];
			const value = formatter ? formatter(rawValue) : this.formatContextValue(rawValue);
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
		const formattedValue = this.formatContextValue(value, suffix);
		return formattedValue ? { label, value: formattedValue, tone } : undefined;
	}

	private eventDetailGroup(
		label: EventDetailGroup['label'],
		items: (EventDetailItem | undefined)[],
	): EventDetailGroup {
		return {
			label,
			items: items.filter((item): item is EventDetailItem => item !== undefined),
		};
	}

	private eventDetailItem(
		label: string,
		value: unknown,
		options: {
			suffix?: string;
			formatBucket?: boolean;
			wide?: boolean;
			infoId?: string;
			infoUrl?: string;
		} = {},
	): EventDetailItem | undefined {
		const formattedValue = this.formatContextValue(
			value,
			options.suffix ?? '',
			options.formatBucket ?? true,
		);
		return formattedValue
			? {
					label,
					value: formattedValue,
					wide: options.wide,
					infoId: options.infoId,
					infoUrl: options.infoUrl,
				}
			: undefined;
	}

	private weatherCodeSummary(code: number | null | undefined): string | undefined {
		if (code === null || code === undefined) {
			return undefined;
		}
		if (code === 0) {
			return 'Clear';
		}
		if (code === 1) {
			return 'Mostly clear';
		}
		if (code === 2) {
			return 'Partly cloudy';
		}
		if (code === 3) {
			return 'Overcast';
		}
		if ([45, 48].includes(code)) {
			return 'Fog';
		}
		if ([51, 53, 55].includes(code)) {
			return 'Drizzle';
		}
		if ([56, 57].includes(code)) {
			return 'Freezing drizzle';
		}
		if ([61, 63, 65].includes(code)) {
			return 'Rain';
		}
		if ([66, 67].includes(code)) {
			return 'Freezing rain';
		}
		if ([71, 73, 75].includes(code)) {
			return 'Snow';
		}
		if (code === 77) {
			return 'Snow grains';
		}
		if ([80, 81, 82].includes(code)) {
			return 'Rain showers';
		}
		if ([85, 86].includes(code)) {
			return 'Snow showers';
		}
		if ([95, 96, 99].includes(code)) {
			return 'Thunderstorm';
		}
		return undefined;
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

	private formatOptionalValue(
		value: unknown,
		suffix = '',
		formatBucket = true,
	): string | undefined {
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

	private formatContextValue(
		value: unknown,
		suffix = '',
		formatBucket = true,
	): string | undefined {
		if (typeof value === 'string' && omittedContextValues.has(value.trim().toUpperCase())) {
			return undefined;
		}
		return this.formatOptionalValue(value, suffix, formatBucket);
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

	private async reverseGeocode(
		segmentId: number,
		lon: number,
		lat: number,
	): Promise<string | undefined> {
		if (this._addressCache.has(segmentId)) {
			return this._addressCache.get(segmentId);
		}

		let address: string | undefined;
		try {
			const response = await fetch(
				`https://api.maptiler.com/geocoding/${lon},${lat}.json?key=${this._mapTilerToken}&limit=1`,
			);
			if (response.ok) {
				const body = (await response.json()) as {
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
		const uniqueTypes = [
			...new Set(factors.map((factor) => this.formatBucketValue(factor.factorType))),
		];
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
