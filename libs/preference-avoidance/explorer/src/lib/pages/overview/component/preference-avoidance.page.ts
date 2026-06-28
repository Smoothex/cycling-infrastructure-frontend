import { CommonModule, DecimalPipe } from '@angular/common';
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
import {
	ProcessingSummary,
	SegmentEvent,
	SegmentEventType,
	SegmentGeoJson,
	SegmentGeoJsonProperties,
	SegmentSummary,
} from '@simra/thesis-common';
import { ThesisAnalysisFacade } from '@simra/thesis-domain';
import { FeatureCollection, LineString } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import { firstValueFrom, forkJoin } from 'rxjs';
import { Card } from 'primeng/card';
import { Skeleton } from 'primeng/skeleton';
import { TableModule } from 'primeng/table';
import { SortEvent } from 'primeng/api';
import { Tag } from 'primeng/tag';

const thesisSegmentsSource = 'thesis-segments-source';
const thesisSegmentsLayer = 'thesis-segments-layer';
const thesisHighlightSource = 'thesis-segments-highlight-source';
const thesisHighlightOutlineLayer = 'thesis-segments-highlight-outline-layer';
const thesisHighlightLayer = 'thesis-segments-highlight-layer';
const berlinMapCenter: [number, number] = [13.413, 52.522];
const berlinMapZoom = 14;

type EventFilter = 'ALL' | SegmentEventType;
type PanelViewMode = 'INFO' | 'EVENTS';

interface SegmentMapProperties extends SegmentGeoJsonProperties {
	eventSignalColor: string;
	eventLineWidth: number;
	eventBalance: number;
}

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

interface OverviewData {
	summary: ProcessingSummary;
	segments: SegmentSummary[];
	geoJson: SegmentGeoJson;
}

type SelectedSegment = SegmentGeoJsonProperties & Partial<Pick<
	SegmentSummary,
	'incidentCount' | 'incidentBreakdown' | 'externalFactors'
>>;

@Component({
	selector: 't-preference-avoidance-page',
	standalone: true,
	imports: [
		CommonModule,
		FormsModule,
		MapPage,
		Card,
		Skeleton,
		TableModule,
		Tag,
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
	private readonly _facade = inject(ThesisAnalysisFacade);
	private readonly _map = signal<maplibregl.Map | undefined>(undefined);

	protected readonly selectedSegmentId = signal<number | undefined>(undefined);
	protected readonly selectedEventId = signal<string | undefined>(undefined);
	protected readonly selectedInfoPopoverId = signal<string | undefined>(undefined);
	protected readonly hoveredSegmentId = signal<number | undefined>(undefined);
	protected readonly selectedEventFilter = signal<EventFilter>('ALL');
	protected readonly selectedPanelView = signal<PanelViewMode>('INFO');
	protected readonly segmentSortField = signal<string>('avoidanceCount');
	protected readonly segmentSortOrder = signal<1 | -1>(-1);
	protected readonly eventFilterOptions: { label: string; value: EventFilter }[] = [
		{ label: 'All events', value: 'ALL' },
		{ label: 'Avoidance', value: 'AVOIDANCE' },
		{ label: 'Preference', value: 'PREFERENCE' },
	];
	protected readonly panelViewOptions: { label: string; value: PanelViewMode }[] = [
		{ label: 'General', value: 'INFO' },
		{ label: 'Events', value: 'EVENTS' },
	];

	protected readonly overview = resource<OverviewData, unknown>({
		loader: async () => firstValueFrom(forkJoin({
			summary: this._facade.getSummary(),
			segments: this._facade.getSegments({ minAvoidanceRatio: 0, minSampleSize: 1, limit: 50 }),
			geoJson: this._facade.getSegmentsGeoJson({
				minAvoidanceRatio: 0,
				minPreferenceRatio: 0,
				minSampleSize: 1,
				limit: 5000,
			}),
		})),
	});

	protected readonly selectedSegmentDetails = resource<SegmentSummary, number | undefined>({
		params: () => this.selectedSegmentId(),
		loader: async ({ params }) => firstValueFrom(this._facade.getSegment(params)),
	});

	protected readonly selectedSegmentEvents = resource<SegmentEvent[], { segmentId: number; eventFilter: EventFilter } | undefined>({
		params: () => {
			const segmentId = this.selectedSegmentId();
			if (!segmentId) {
				return undefined;
			}

			return {
				segmentId,
				eventFilter: this.selectedEventFilter(),
			};
		},
		defaultValue: [],
		loader: async ({ params }) => {
			return firstValueFrom(this._facade.getSegmentEvents(params.segmentId, {
				eventType: params.eventFilter === 'ALL' ? undefined : params.eventFilter,
				limit: 1000,
			}));
		},
	});

	protected readonly sortedSegments = computed(() => {
		const segments = this.overview.value()?.segments ?? [];
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

	protected readonly summaryCards = computed(() => {
		const summary = this.overview.value()?.summary;
		if (!summary) {
			return [];
		}

		return [
			{ label: 'Total rides', value: summary.totalRides },
			{ label: 'Processed rides', value: summary.rideStatusCounts?.['PROCESSED'] ?? 0 },
			{ label: 'Segment events', value: summary.totalSegmentEvents },
			{ label: 'Observed segments', value: summary.observedSegments },
			{ label: 'Traffic enriched', value: summary.trafficEnrichedEvents },
			{ label: 'Weather enriched', value: summary.weatherEnrichedEvents },
			{ label: 'Historical OSM data enriched', value: summary.ohsomeEnrichedEvents },
			{ label: 'Traffic measured', value: summary.trafficMeasuredEvents },
		];
	});

	protected readonly selectedSegment = computed<SelectedSegment | undefined>(() => {
		const segmentId = this.selectedSegmentId();
		const segmentDetails = this.selectedSegmentDetails.value();
		if (segmentDetails) {
			return segmentDetails;
		}

		const segments = this.overview.value()?.segments ?? [];
		const segment = segments.find((currentSegment) => currentSegment.id === segmentId);
		if (segment) {
			return segment;
		}

		const mapFeature = this.overview.value()?.geoJson.features.find((feature) => feature.properties?.id === segmentId);
		return mapFeature?.properties;
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
		const events = this.selectedSegmentEvents.value() ?? [];
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
		effect(() => {
			const map = this._map();
			const geoJson = this.overview.value()?.geoJson;
			if (!map || !geoJson) {
				return;
			}

			this.renderSegments(map, geoJson);
		});

		effect(() => {
			const selectedId = this.selectedSegmentId();
			const firstSegment = this.overview.value()?.segments?.[0];
			if (!selectedId && firstSegment) {
				this.selectSegment(firstSegment.id);
			}
		});

		// Hover effect from table rows: show highlight without changing selection
		effect(() => {
			const hoveredId = this.hoveredSegmentId();
			const selectedId = this.selectedSegmentId();
			const map = this._map();
			const geoJson = this.overview.value()?.geoJson;
			if (!map || !geoJson) {
				return;
			}

			// If hovering a different segment than selected, show hover highlight
			if (hoveredId && hoveredId !== selectedId) {
				const feature = geoJson.features.find((f) => f.properties?.id === hoveredId);
				if (feature) {
					this.setHighlight(map, feature);
				}
			} else if (!hoveredId) {
				// Restore selected segment highlight or clear
				if (selectedId) {
					const feature = geoJson.features.find((f) => f.properties?.id === selectedId);
					if (feature) {
						this.setHighlight(map, feature);
					}
				} else {
					this.clearHighlight(map);
				}
			}
		});
	}

	protected onMapReady(map: maplibregl.Map): void {
		map.jumpTo({ center: berlinMapCenter, zoom: berlinMapZoom });
		this._map.set(map);
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

	protected flyToSegment(segmentId: number): void {
		this.selectSegment(segmentId);
		const map = this._map();
		const geoJson = this.overview.value()?.geoJson;
		if (!map || !geoJson) {
			return;
		}

		const feature = geoJson.features.find((f) => f.properties?.id === segmentId);
		if (!feature) {
			return;
		}

		const coordinates = feature.geometry.coordinates;
		const bounds = coordinates.reduce((currentBounds, coordinate) => {
			return currentBounds.extend(coordinate as [number, number]);
		}, new maplibregl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number]));

		map.fitBounds(bounds, { padding: 80, maxZoom: 16, duration: 800 });

		this.setHighlight(map, feature);
	}

	protected onEventFilterChange(value: string): void {
		this.selectedEventId.set(undefined);
		this.selectedInfoPopoverId.set(undefined);
		this.selectedEventFilter.set(value as EventFilter);
	}

	protected onPanelViewChange(value: PanelViewMode): void {
		this.selectedPanelView.set(value);
	}

	protected onEventCardClick(eventId: string): void {
		this.selectedInfoPopoverId.set(undefined);
		this.selectedEventId.update((selectedEventId) => selectedEventId === eventId ? undefined : eventId);
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

	protected formatValue(value: unknown, suffix = ''): string {
		if (value === null || value === undefined || value === '') {
			return '-';
		}
		if (typeof value === 'number') {
			return `${value.toLocaleString('en', { maximumFractionDigits: 1 })}${suffix}`;
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
		return [
			this.eventChip('Cycleway', event.cyclewayType, 'infrastructure'),
			this.eventChip('Highway', event.highway, 'infrastructure'),
			this.eventChip('Surface', event.surface, 'infrastructure'),
			this.eventChip('Traffic', event.trafficCondition, 'traffic'),
			this.eventChip('Volume', event.trafficVolumeKfz, 'traffic', ' kfz'),
			this.eventChip('Wind', event.windExposure, 'wind'),
			this.eventChip('Weather', event.temperature2m, 'weather', '°C'),
			this.eventChip('Wind speed', event.windSpeed10m, 'wind', ' km/h'),
		].filter((chip): chip is EventChip => chip !== undefined).slice(0, 4);
	}

	protected eventDetailGroups(event: SegmentEvent): EventDetailGroup[] {
		return [
			this.eventDetailGroup('Ride', [
				this.eventDetailItem('Intent', event.rideIntent),
				this.eventDetailItem('Bike type', event.bikeType),
				this.eventDetailItem('Ride id', event.rideId, { formatBucket: false }),
			]),
			event.weatherEnriched ? this.eventDetailGroup('Weather', [
				this.eventDetailItem('Temperature', event.temperature2m, { suffix: '°C' }),
				this.eventDetailItem('Precipitation', event.precipitation, { suffix: ' mm' }),
				this.eventDetailItem('Wind exposure', event.windExposure),
				this.eventDetailItem('Wind speed', event.windSpeed10m, { suffix: ' km/h' }),
				this.eventDetailItem('Weather code', this.formatWeatherCode(event.weatherCode), {
					formatBucket: false,
					infoId: `${event.id}-weather-code`,
					infoUrl: 'https://open-meteo.com/en/docs#weather_variable_documentation',
				}),
			]) : undefined,
			event.ohsomeEnriched ? this.eventDetailGroup('Cycling infrastructure', [
				this.eventDetailItem('Cycleway location', event.cyclewayLocation),
				this.eventDetailItem('Cycleway type', event.cyclewayType),
			]) : undefined,
			event.trafficEnriched ? this.eventDetailGroup('Traffic', [
				this.eventDetailItem('Condition', event.trafficCondition),
				this.eventDetailItem('Source type', event.trafficSourceType),
				this.eventDetailItem('Status', event.trafficEnrichmentStatus),
				this.eventDetailItem('Traffic volume', event.trafficVolumeKfz, { suffix: ' kfz' }),
				this.eventDetailItem('Traffic speed', event.trafficSpeedKfz, { suffix: ' km/h' }),
				this.eventDetailItem('Car volume', event.trafficVolumePkw, { suffix: ' pkw' }),
				this.eventDetailItem('Car speed', event.trafficSpeedPkw, { suffix: ' km/h' }),
				this.eventDetailItem('Truck volume', event.trafficVolumeLkw, { suffix: ' lkw' }),
				this.eventDetailItem('Truck speed', event.trafficSpeedLkw, { suffix: ' km/h' }),
			]) : undefined,
		].filter((group): group is EventDetailGroup => group !== undefined && group.items.length > 0);
	}

	protected eventRange(summary?: ProcessingSummary): string {
		if (!summary?.earliestEventTimestamp || !summary?.latestEventTimestamp) {
			return 'No event timestamps available';
		}
		return `${this.formatDate(summary.earliestEventTimestamp)} - ${this.formatDate(summary.latestEventTimestamp)}`;
	}

	private renderSegments(map: maplibregl.Map, geoJson: SegmentGeoJson): void {
		const collection = this.withMapProperties(geoJson);
		const existingSource = map.getSource(thesisSegmentsSource) as maplibregl.GeoJSONSource | undefined;
		if (existingSource) {
			existingSource.setData(collection);
			return;
		}

		map.addSource(thesisSegmentsSource, {
			type: 'geojson',
			data: collection,
		});

		map.addLayer({
			id: thesisSegmentsLayer,
			type: 'line',
			source: thesisSegmentsSource,
			paint: {
				'line-color': ['get', 'eventSignalColor'],
				'line-width': ['interpolate', ['linear'], ['get', 'eventLineWidth'], 1, 1.5, 8, 8],
				'line-opacity': 0.88,
			},
		});

		map.addSource(thesisHighlightSource, {
			type: 'geojson',
			data: { type: 'FeatureCollection', features: [] },
		});

		map.addLayer({
			id: thesisHighlightOutlineLayer,
			type: 'line',
			source: thesisHighlightSource,
			paint: {
				'line-color': '#111827',
				'line-width': ['+', ['get', 'eventLineWidth'], 5],
				'line-opacity': 1,
				'line-blur': 0.25,
			},
		});

		map.addLayer({
			id: thesisHighlightLayer,
			type: 'line',
			source: thesisHighlightSource,
			paint: {
				'line-color': ['get', 'eventSignalColor'],
				'line-width': ['+', ['get', 'eventLineWidth'], 2],
				'line-opacity': 1,
			},
		});

		map.on('mouseenter', thesisSegmentsLayer, () => {
			map.getCanvas().style.cursor = 'pointer';
		});
		map.on('mouseleave', thesisSegmentsLayer, () => {
			map.getCanvas().style.cursor = 'default';
		});
		map.on('click', thesisSegmentsLayer, (event) => {
			const feature = event.features?.[0];
			if (!feature?.properties) {
				return;
			}

			this.selectSegment(Number(feature.properties['id']));
			this.setHighlight(map, feature as GeoJSON.Feature<GeoJSON.LineString>);
		});

		map.on('click', (event) => {
			const features = map.queryRenderedFeatures(event.point, { layers: [thesisSegmentsLayer] });
			if (features.length === 0) {
				this.selectSegment(undefined);
				this.clearHighlight(map);
			}
		});

		map.jumpTo({ center: berlinMapCenter, zoom: berlinMapZoom });
	}

	private setHighlight(map: maplibregl.Map, feature: GeoJSON.Feature<GeoJSON.LineString>): void {
		const source = map.getSource(thesisHighlightSource) as maplibregl.GeoJSONSource | undefined;
		const properties = feature.properties as SegmentGeoJsonProperties;
		const highlightedFeature: GeoJSON.Feature<GeoJSON.LineString> = {
			...feature,
			properties: {
				...properties,
				eventSignalColor: this.eventSignalColor(properties),
				eventLineWidth: this.eventLineWidth(properties),
				eventBalance: this.eventBalance(properties),
			},
		};
		source?.setData({ type: 'FeatureCollection', features: [highlightedFeature] });
	}

	private clearHighlight(map: maplibregl.Map): void {
		const source = map.getSource(thesisHighlightSource) as maplibregl.GeoJSONSource | undefined;
		source?.setData({ type: 'FeatureCollection', features: [] });
	}

	private withMapProperties(geoJson: SegmentGeoJson): FeatureCollection<LineString, SegmentMapProperties> {
		return {
			...geoJson,
			features: geoJson.features.map((feature) => ({
				...feature,
				properties: {
					...feature.properties,
					eventSignalColor: this.eventSignalColor(feature.properties),
					eventLineWidth: this.eventLineWidth(feature.properties),
					eventBalance: this.eventBalance(feature.properties),
				},
			})),
		};
	}

	private fitBounds(map: maplibregl.Map, geoJson: FeatureCollection<LineString, SegmentGeoJsonProperties>): void {
		const coordinates = geoJson.features.flatMap((feature) => feature.geometry.coordinates);
		if (!coordinates.length) {
			return;
		}

		const bounds = coordinates.reduce((currentBounds, coordinate) => {
			return currentBounds.extend(coordinate as [number, number]);
		}, new maplibregl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number]));

		map.fitBounds(bounds, { padding: 48, maxZoom: 13, duration: 0 });
	}

	private eventSignalColor(segment?: Pick<
		SegmentGeoJsonProperties,
		'avoidanceCount' | 'preferenceCount' | 'avoidanceRatio' | 'preferenceRatio'
	>): string {
		const balance = this.eventBalance(segment);
		const eventCount = (segment?.avoidanceCount ?? 0) + (segment?.preferenceCount ?? 0);
		if (eventCount === 0) {
			return '#d1d5db';
		}
		if (balance <= -0.6) {
			return '#991b1b';
		}
		if (balance <= -0.3) {
			return '#dc2626';
		}
		if (balance <= -0.1) {
			return '#fca5a5';
		}
		if (balance >= 0.6) {
			return '#166534';
		}
		if (balance >= 0.3) {
			return '#16a34a';
		}
		if (balance >= 0.1) {
			return '#86efac';
		}
		return '#6b7280';
	}

	private eventLineWidth(segment?: Pick<SegmentGeoJsonProperties, 'avoidanceCount' | 'preferenceCount'>): number {
		const events = (segment?.avoidanceCount ?? 0) + (segment?.preferenceCount ?? 0);
		return Math.min(8, Math.max(1.5, 1.5 + Math.log10(events + 1) * 2.2));
	}

	private eventBalance(segment?: Pick<
		SegmentGeoJsonProperties,
		'avoidanceCount' | 'preferenceCount' | 'avoidanceRatio' | 'preferenceRatio'
	>): number {
		if (segment?.avoidanceRatio !== undefined || segment?.preferenceRatio !== undefined) {
			return (segment.preferenceRatio ?? 0) - (segment.avoidanceRatio ?? 0);
		}

		const avoidance = segment?.avoidanceCount ?? 0;
		const preference = segment?.preferenceCount ?? 0;
		const total = avoidance + preference;
		return total > 0 ? (preference - avoidance) / total : 0;
	}

	private selectSegment(segmentId: number | undefined): void {
		if (this.selectedSegmentId() !== segmentId) {
			this.selectedEventId.set(undefined);
			this.selectedInfoPopoverId.set(undefined);
		}
		this.selectedSegmentId.set(segmentId);
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
		options: { suffix?: string; formatBucket?: boolean; formatter?: (value: unknown) => string; infoId?: string; infoUrl?: string } = {},
	): EventDetailItem | undefined {
		if (value === null || value === undefined || value === '') {
			return undefined;
		}

		const formattedValue = options.formatter
			? options.formatter(value)
			: this.formatOptionalValue(value, options.suffix ?? '', options.formatBucket ?? true);
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

	private formatTraffic(segment?: SelectedSegment): string {
		const volume = this.numberOrUndefined(segment?.traffic?.averageTrafficVolumeKfz);
		const speed = this.numberOrUndefined(segment?.traffic?.averageTrafficSpeedKfz);
		if (volume === undefined && speed === undefined) {
			return '-';
		}
		if (volume !== undefined && speed !== undefined) {
			return `${volume.toFixed(0)} kfz / ${speed.toFixed(1)} km/h`;
		}
		if (volume !== undefined) {
			return `${volume.toFixed(0)} kfz`;
		}
		return `${speed?.toFixed(1)} km/h`;
	}

	private numberOrUndefined(value: number | null | undefined): number | undefined {
		return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
	}

	private formatIncidentBreakdown(segment?: SelectedSegment): string | undefined {
		const breakdown = segment?.incidentBreakdown ?? [];
		if (!breakdown.length) {
			return undefined;
		}
		return breakdown
			.slice(0, 2)
			.map((incident) => `${this.formatBucketValue(incident.incidentType)} ${incident.count}`)
			.join(', ');
	}

	private formatExternalFactors(segment?: SelectedSegment): string | undefined {
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

	private formatDate(timestamp: number): string {
		return new Intl.DateTimeFormat('en', {
			year: 'numeric',
			month: 'short',
			day: '2-digit',
		}).format(new Date(timestamp));
	}
}
