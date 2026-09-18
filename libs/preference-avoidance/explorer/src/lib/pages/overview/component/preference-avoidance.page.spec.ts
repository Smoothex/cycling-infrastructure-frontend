import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, input, output, WritableSignal } from '@angular/core';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import { MapillaryViewerComponent, MapPage } from '@simra/common-components';
import { APP_CONFIG } from '@simra/common-models';
import {
	CorridorRanking,
	SegmentEnrichmentFilter,
	SegmentEvent,
} from '@simra/preference-avoidance-common';
import { PreferenceAvoidanceAnalysisFacade } from '@simra/preference-avoidance-domain';
import { Polygon } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import { of, Subject } from 'rxjs';
import { PreferenceAvoidancePage } from './preference-avoidance.page';

type ExplorerTab = 'MAP' | 'ANALYTICS' | 'SEGMENTS' | 'ROUTE_COMPARISONS';

@Component({
	selector: 't-map-component',
	standalone: true,
	template: '',
})
class MapPageStubComponent {
	readonly isNavigable = input(false);
	readonly mapReady = output<never>();
}

@Component({
	selector: 't-mapillary-viewer',
	standalone: true,
	template: '',
})
class MapillaryViewerStubComponent {
	readonly latitude = input<number | undefined>();
	readonly longitude = input<number | undefined>();
	readonly year = input<number | undefined>();
}

interface TestablePreferenceAvoidancePage {
	setSelectedHighlight(map: maplibregl.Map, geometry: unknown, properties: unknown): void;
	filteredTileUrl(): string;
	syncMatchedSource(map: maplibregl.Map, url?: string): void;
	applyMapFilters(map: maplibregl.Map): void;
	roadClosures: {
		value: () => { id: string; lon: number; lat: number; lines: number[][][] }[] | undefined;
	};
	roadClosurePopupHtml(features: maplibregl.MapGeoJSONFeature[]): string;
	registerMapHandlers(map: maplibregl.Map): void;
	openRoadClosurePopup(
		map: maplibregl.Map,
		features: maplibregl.MapGeoJSONFeature[],
		lngLat: maplibregl.LngLat,
	): void;
	rideIntentOptions(): string[];
	trafficConditionOptions(): string[];
	selectedYear: WritableSignal<number | undefined>;
	selectedRideIntent: WritableSignal<string | undefined>;
	selectedTrafficCondition: WritableSignal<string | undefined>;
	selectedEnrichmentFilters: WritableSignal<SegmentEnrichmentFilter[]>;
	selectedRiskLegendBuckets: WritableSignal<string[]>;
	selectedTab: WritableSignal<ExplorerTab>;
	routeReviewDirty: WritableSignal<boolean>;
	pendingTab: WritableSignal<ExplorerTab | undefined>;
	selectedPanelView: WritableSignal<'INFO' | 'EVENTS' | 'STREET_VIEW'>;
	selectedSegmentId: WritableSignal<number | undefined>;
	selectedCorridorSegmentIds: WritableSignal<number[]>;
	rideDetailItems(event: SegmentEvent): { label: string; value: string }[];
	eventPreviewChips(event: SegmentEvent): { label: string; value: string }[];
	eventConditionRows(event: SegmentEvent): {
		label: string;
		summary: string;
		detailGroups?: {
			label: string;
			description?: string;
			items: { label: string; value: string; wide?: boolean }[];
		}[];
	}[];
	onClearAllFilters(): void;
	onTabChange(tab: ExplorerTab): void;
	discardRouteReviewAndSwitchTab(): void;
	onTableRowSelected(segmentId: number): void;
	onViewCorridorOnMap(corridor: CorridorRanking): void;
	trafficDetectorPopupCoordinate(
		map: maplibregl.Map,
		geometry: Polygon,
		fallback: [number, number],
	): [number, number];
}

describe('PreferenceAvoidancePage', () => {
	let fixture: ComponentFixture<PreferenceAvoidancePage>;
	let component: TestablePreferenceAvoidancePage;
	const facade = {
		getSummary: jest.fn().mockReturnValue(
			of({
				totalRides: 0,
				rideStatusCounts: {},
				totalSegments: 0,
				observedSegments: 0,
				totalSegmentEvents: 0,
				segmentEventTypeCounts: {},
				weatherEnrichedEvents: 0,
				ohsomeEnrichedEvents: 0,
				berlinOpenDataEnrichedEvents: 0,
				trafficEnrichedEvents: 0,
				trafficMeasuredEvents: 0,
				roadDisruptionAffectedEvents: 12,
			}),
		),
		getFilterOptions: jest.fn().mockReturnValue(of({
			rideIntents: ['COMMUTE', 'UNKNOWN'],
			trafficConditions: ['LIGHT', 'HEAVY'],
		})),
		getSegments: jest.fn().mockReturnValue(of([])),
		getTileStatus: jest.fn().mockReturnValue(of(undefined)),
		getTrafficDetectors: jest.fn().mockReturnValue(of(undefined)),
		getNearMissIncidents: jest.fn().mockReturnValue(of([])),
		getRoadClosures: jest.fn().mockReturnValue(of([])),
		getSegment: jest.fn().mockReturnValue(of(undefined)),
		getSegmentEvents: jest.fn().mockReturnValue(of([])),
		getDistribution: jest.fn().mockReturnValue(of([])),
		getSegmentsGeoJson: jest
			.fn()
			.mockReturnValue(of({ type: 'FeatureCollection', features: [] })),
		getCorridorGeometry: jest.fn().mockReturnValue(
			of({
				streetName: 'Schönhauser Allee',
				segmentIds: [],
				geometry: { type: 'MultiLineString', coordinates: [] },
			}),
		),
		getRouteReviewSample: jest.fn().mockReturnValue(
			of({
				sampleSizePerType: 30,
				totalItems: 0,
				reviewedItems: 0,
				representativeOfPrevalence: false,
				items: [],
			}),
		),
		getRouteReviewDetail: jest.fn(),
		saveRouteReview: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		facade.getSegment.mockReturnValue(of(undefined));
		await TestBed.configureTestingModule({
			imports: [PreferenceAvoidancePage],
			providers: [
				provideRouter([]),
				{ provide: PreferenceAvoidanceAnalysisFacade, useValue: facade },
				{
					provide: APP_CONFIG,
					useValue: { mapTilerToken: 'test-token' },
				},
			],
		})
			.overrideComponent(PreferenceAvoidancePage, {
				remove: { imports: [MapPage, MapillaryViewerComponent] },
				add: { imports: [MapPageStubComponent, MapillaryViewerStubComponent] },
			})
			.compileComponents();

		fixture = TestBed.createComponent(PreferenceAvoidancePage);
		component = fixture.componentInstance as unknown as TestablePreferenceAvoidancePage;
		fixture.detectChanges();
		await fixture.whenStable();
	});

	it('loads both dropdowns once without requesting full distributions', () => {
		expect(facade.getFilterOptions).toHaveBeenCalledTimes(1);
		expect(facade.getDistribution).not.toHaveBeenCalled();
		expect(component.rideIntentOptions()).toEqual(['COMMUTE', 'UNKNOWN']);
		expect(component.trafficConditionOptions()).toEqual(['LIGHT', 'HEAVY']);
	});

	it('reuses global options when changing filters', async () => {
		component.selectedYear.set(2024);
		component.selectedRideIntent.set('COMMUTE');
		fixture.detectChanges();
		await fixture.whenStable();
		expect(facade.getFilterOptions).toHaveBeenCalledTimes(1);
		expect(facade.getDistribution).not.toHaveBeenCalled();
		expect(facade.getSegments).toHaveBeenLastCalledWith(expect.objectContaining({ rideIntent: 'COMMUTE' }));
	});

	const disruptionFeature = (id: string, validFrom: number, content: string, layer = 'line') =>
		({
			properties: {
				id,
				validFrom,
				content,
				street: 'Einsteinufer',
				factorType: 'CONSTRUCTION',
			},
			layer: { id: `preference-avoidance-road-closures-${layer}-layer` },
		}) as unknown as maplibregl.MapGeoJSONFeature;

	it('shows overlapping disruption records once each, with the latest start first', () => {
		const older = disruptionFeature('old', Date.UTC(2024, 5, 1), 'Earlier works');
		const newer = disruptionFeature('new', Date.UTC(2024, 10, 19), 'Later works');
		const duplicate = disruptionFeature('new', Date.UTC(2024, 10, 19), 'Later works', 'point');
		const html = component.roadClosurePopupHtml([older, newer, duplicate]);
		const popup = document.createElement('div');
		popup.innerHTML = html;
		expect(popup.querySelectorAll('.road-closure-popup__entry')).toHaveLength(2);
		expect(popup.textContent).toContain('2 records at this location');
		expect(html.indexOf('Later works')).toBeLessThan(html.indexOf('Earlier works'));
		expect(popup.textContent).toContain('open-ended');
	});

	it('keeps distinct records with equal start dates and escapes source text', () => {
		const a = disruptionFeature('a', 1000, '<img src=x onerror=alert(1)>');
		const b = disruptionFeature('b', 1000, 'Other works');
		const popup = document.createElement('div');
		popup.innerHTML = component.roadClosurePopupHtml([b, a]);
		expect(popup.querySelectorAll('.road-closure-popup__entry')).toHaveLength(2);
		expect(popup.querySelector('img')).toBeNull();
		expect(popup.textContent).toContain('<img src=x onerror=alert(1)>');
		expect(component.roadClosurePopupHtml([a])).not.toContain('records at this location');
	});

	it('shows a period-only change without repeating the street, type or description', () => {
		const older = disruptionFeature('old', Date.UTC(2024, 5, 1), 'Carriageway narrowed');
		const newer = disruptionFeature('new', Date.UTC(2024, 10, 19), 'Carriageway narrowed');
		const popup = document.createElement('div');
		popup.innerHTML = component.roadClosurePopupHtml([older, newer]);
		expect(popup.querySelectorAll('h4')).toHaveLength(1);
		expect(popup.textContent?.match(/Carriageway narrowed/g)).toHaveLength(1);
		const changes = popup.querySelector('.road-closure-popup__changes');
		expect(changes?.textContent).toContain('Previous period');
		expect(changes?.querySelector('h5')).toBeNull();
		expect(changes?.textContent).not.toContain('Earlier record');
		expect(changes?.querySelectorAll('dl > div')).toHaveLength(1);
		expect(popup.textContent).not.toContain('newest start first');
	});

	it('preserves changed type, description, severity, direction and section in earlier records', () => {
		const older = disruptionFeature('old', 1000, 'Old description');
		older.properties = {
			...older.properties,
			factorType: 'EVENT',
			severity: 'FULL_CLOSURE',
			direction: 'East',
			section: 'A to B',
		};
		const newer = disruptionFeature('new', 2000, 'New description');
		newer.properties = {
			...newer.properties,
			severity: 'NO_CLOSURE',
			direction: 'West',
			section: 'B to C',
		};
		const popup = document.createElement('div');
		popup.innerHTML = component.roadClosurePopupHtml([older, newer]);
		const changes = popup.querySelector('.road-closure-popup__changes');
		for (const label of [
			'Previous type',
			'Previous description',
			'Previous severity',
			'Previous direction',
			'Previous section',
		]) {
			expect(changes?.textContent).toContain(label);
		}
		expect(changes?.textContent).toContain('Old description');
		expect(changes?.textContent).not.toContain('New description');
	});

	it('makes cleared fields explicit and does not invent chronology for equal start dates', () => {
		const older = disruptionFeature('old', 1000, 'Original description');
		const newer = disruptionFeature('new', 2000, '');
		const popup = document.createElement('div');
		popup.innerHTML = component.roadClosurePopupHtml([older, newer]);
		expect(popup.querySelector('.road-closure-popup__entry')?.textContent).toContain(
			'Not recorded',
		);
		expect(popup.textContent).toContain('Original description');
		const sameTime = disruptionFeature('other', 2000, 'Other notice');
		popup.innerHTML = component.roadClosurePopupHtml([newer, sameTime]);
		expect(popup.textContent).toContain('Other record');
		expect(popup.textContent).not.toContain('Earlier record');
	});

	it('reports changed mapped areas using complete API geometry, not map tile fragments', () => {
		jest.spyOn(component.roadClosures, 'value').mockReturnValue([
			{
				id: 'old',
				lon: 13.32,
				lat: 52.52,
				lines: [
					[
						[13.32, 52.52],
						[13.33, 52.52],
					],
				],
			},
			{
				id: 'new',
				lon: 13.32,
				lat: 52.52,
				lines: [
					[
						[13.32, 52.52],
						[13.34, 52.52],
					],
				],
			},
		]);
		const popup = document.createElement('div');
		popup.innerHTML = component.roadClosurePopupHtml([
			disruptionFeature('old', 1000, 'Works'),
			disruptionFeature('new', 2000, 'Works'),
		]);
		expect(popup.textContent).toContain('Mapped area');
		expect(popup.textContent).toContain('Different from the record above');
	});

	it('opens one popup with hits from every disruption layer', () => {
		const hits = [
			disruptionFeature('old', 1, 'Earlier', 'line'),
			disruptionFeature('new', 2, 'Later', 'point'),
			disruptionFeature('new', 2, 'Later', 'symbol'),
		];
		const map = {
			on: jest.fn(),
			getLayer: jest.fn().mockReturnValue({}),
			queryRenderedFeatures: jest.fn().mockReturnValue(hits),
		} as unknown as maplibregl.Map;
		const open = jest
			.spyOn(component, 'openRoadClosurePopup')
			.mockImplementation(() => undefined);
		component.registerMapHandlers(map);
		const clicks = (map.on as jest.Mock).mock.calls.filter(
			([event, handler]) => event === 'click' && typeof handler === 'function',
		);
		expect(clicks).toHaveLength(1);
		const lngLat = { lng: 13.32, lat: 52.52 };
		clicks[0][1]({ point: { x: 10, y: 10 }, lngLat });
		expect(open).toHaveBeenCalledTimes(1);
		expect(open).toHaveBeenCalledWith(map, hits, lngLat);
	});

	it.each([
		'preference-avoidance-streets-layer',
		'preference-avoidance-segments-layer',
		'preference-avoidance-matched-layer',
	])('selects a segment clicked on %s', (layer) => {
		const map = { on: jest.fn() } as unknown as maplibregl.Map;
		jest.spyOn(component, 'setSelectedHighlight').mockImplementation(() => undefined);
		component.registerMapHandlers(map);
		const handler = (map.on as jest.Mock).mock.calls.find(
			([event, layerId]) => event === 'click' && layerId === layer,
		)?.[2];
		expect(handler).toBeDefined();
		handler({ features: [{ properties: { id: 27922832, avoidanceCount: 9, preferenceCount: 29 },
			geometry: { type: 'LineString', coordinates: [[13.412, 52.507], [13.414, 52.508]] } }] });
		expect(component.selectedSegmentId()).toBe(27922832);
		expect(component.setSelectedHighlight).toHaveBeenCalled();
	});

	it('clears every data filter while preserving the active tab', () => {
		component.selectedYear.set(2024);
		component.selectedRideIntent.set('COMMUTE');
		component.selectedTrafficCondition.set('HEAVY');
		component.selectedEnrichmentFilters.set(['WEATHER_ENRICHED']);
		component.selectedRiskLegendBuckets.set(['AVOIDANCE']);
		component.selectedTab.set('SEGMENTS');

		component.onClearAllFilters();

		expect(component.selectedYear()).toBeUndefined();
		expect(component.selectedRideIntent()).toBeUndefined();
		expect(component.selectedTrafficCondition()).toBeUndefined();
		expect(component.selectedEnrichmentFilters()).toEqual([]);
		expect(component.selectedRiskLegendBuckets()).toEqual([]);
		expect(component.selectedTab()).toBe('SEGMENTS');
	});

	it('shows active filter styling independently of focus', () => {
		const clearButton: HTMLButtonElement = fixture.nativeElement.querySelector(
			'.pa-global-filters__clear',
		);
		expect(clearButton.disabled).toBe(true);
		expect(fixture.nativeElement.textContent).not.toContain('Min incidents');

		component.selectedYear.set(2024);
		component.selectedRideIntent.set('COMMUTE');
		component.selectedTrafficCondition.set('HEAVY');
		component.selectedEnrichmentFilters.set(['OHSOME_ENRICHED']);
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelectorAll('.filter-control--active')).toHaveLength(3);
		expect(
			fixture.nativeElement.querySelector('.pa-enrichment-chip--selected .ph-check'),
		).not.toBeNull();
		expect(clearButton.disabled).toBe(false);
	});

	it('keeps the selected segment while showing year-aware Street View', async () => {
		facade.getSegment.mockReturnValue(
			of({
				id: 42,
				streetName: 'Test street',
				geometry: {
					type: 'LineString',
					coordinates: [
						[13.4, 52.52],
						[13.42, 52.52],
					],
				},
			}),
		);
		component.selectedSegmentId.set(42);
		component.selectedYear.set(2022);
		component.selectedPanelView.set('STREET_VIEW');
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const viewer = fixture.debugElement.query(By.directive(MapillaryViewerStubComponent))
			.componentInstance as MapillaryViewerStubComponent;
		expect(component.selectedSegmentId()).toBe(42);
		expect(viewer.latitude()).toBeCloseTo(52.52, 5);
		expect(viewer.longitude()).toBeCloseTo(13.41, 5);
		expect(viewer.year()).toBe(2022);
	});

	it('groups event data filters under concise labels', () => {
		fixture.detectChanges();
		const text = fixture.nativeElement.textContent as string;
		const chips = [
			...fixture.nativeElement.querySelectorAll('.pa-enrichment-chip'),
		] as HTMLButtonElement[];

		expect(text).toContain('Ride purpose');
		expect(text).toContain('Traffic condition');
		expect(text).toContain('Data available');
		expect(chips.map((chip) => chip.textContent?.trim())).toEqual([
			'Weather',
			'Cycling infrastructure',
			'Traffic measurements',
			'Road disruptions',
		]);
		expect(chips[1].title).toContain('applicable at the event date');
		expect(text).toContain('Weather data');
		expect(text).toContain('Cycling infrastructure data');
		expect(text).toContain('Events with road disruptions');
		expect(text).not.toContain('Historical OSM data enriched');

		const disruptionKpi = [...fixture.nativeElement.querySelectorAll('.pa-kpi-tile')].find(
			(tile: Element) => tile.textContent?.includes('Events with road disruptions'),
		);
		expect(disruptionKpi?.querySelector('strong')?.textContent?.trim()).toBe('12');
	});

	it('shows route comparisons as a dedicated tab without unrelated global filters', async () => {
		component.selectedTab.set('ROUTE_COMPARISONS');
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector('.year-select')).toBeNull();
		expect(fixture.nativeElement.querySelector('.pa-global-filters')).toBeNull();
		expect(fixture.nativeElement.textContent).toContain('Route-comparison reviewer');
		expect(facade.getRouteReviewSample).toHaveBeenCalled();
	});

	it('does not leave the reviewer while a manual decision is unsaved', () => {
		component.selectedTab.set('ROUTE_COMPARISONS');
		component.routeReviewDirty.set(true);

		component.onTabChange('MAP');

		expect(component.selectedTab()).toBe('ROUTE_COMPARISONS');
		expect(component.pendingTab()).toBe('MAP');

		component.discardRouteReviewAndSwitchTab();
		expect(component.selectedTab()).toBe('MAP');
	});

	it('passes active filters to aggregate segment requests without per-segment qualification calls', async () => {
		component.selectedYear.set(2024);
		component.selectedRideIntent.set('COMMUTE');
		component.selectedTrafficCondition.set('CONGESTED');
		component.selectedEnrichmentFilters.set(['ROAD_DISRUPTION_AFFECTED', 'TRAFFIC_MEASURED']);

		fixture.detectChanges();
		await fixture.whenStable();

		const expectedFilters = expect.objectContaining({
			from: Date.UTC(2024, 0, 1),
			to: Date.UTC(2025, 0, 1) - 1,
			rideIntent: 'COMMUTE',
			trafficCondition: 'CONGESTED',
			enrichmentFilters: ['ROAD_DISRUPTION_AFFECTED', 'TRAFFIC_MEASURED'],
		});
		expect(facade.getSegments).toHaveBeenLastCalledWith(expectedFilters);
		expect(facade.getSegmentsGeoJson).not.toHaveBeenCalled();
		const tileUrl = new URL(component.filteredTileUrl());
		expect(tileUrl.pathname).toBe('/api/segments/tiles/%7Bz%7D/%7Bx%7D/%7By%7D.mvt');
		expect(Object.fromEntries(tileUrl.searchParams)).toEqual({
			from: String(Date.UTC(2024, 0, 1)),
			to: String(Date.UTC(2025, 0, 1) - 1),
			rideIntent: 'COMMUTE',
			trafficCondition: 'CONGESTED',
			enrichmentFilters: 'ROAD_DISRUPTION_AFFECTED,TRAFFIC_MEASURED',
		});
		expect(facade.getSegmentEvents).not.toHaveBeenCalled();
	});

	it('uses canonical vector tile URLs for combined availability filters without a GeoJSON request', async () => {
		component.selectedEnrichmentFilters.set(['WEATHER_ENRICHED', 'OHSOME_ENRICHED']);
		fixture.detectChanges();
		await fixture.whenStable();
		const url = component.filteredTileUrl();
		component.selectedEnrichmentFilters.set(['OHSOME_ENRICHED', 'WEATHER_ENRICHED']);
		expect(component.filteredTileUrl()).toBe(url);
		expect(facade.getSegmentsGeoJson).not.toHaveBeenCalled();
		// MapLibre exposes its configured URL immediately via serialize(), but
		// source.tiles is undefined until its asynchronous metadata load finishes.
		const source = { serialize: () => ({ type: 'vector', tiles: [url] }), setTiles: jest.fn() };
		const map = { getSource: () => source } as unknown as maplibregl.Map;
		component.syncMatchedSource(map);
		expect(source.setTiles).not.toHaveBeenCalled();
		component.selectedRideIntent.set('COMMUTE');
		component.syncMatchedSource(map);
		expect(source.setTiles).toHaveBeenCalledWith([component.filteredTileUrl()]);
	});

	it('keeps filtered tiles visible for combined filters and restores PMTiles when cleared', () => {
		const map = {
			getLayer: () => ({}),
			setFilter: jest.fn(),
			setPaintProperty: jest.fn(),
			setLayoutProperty: jest.fn(),
		} as unknown as maplibregl.Map;
		component.selectedYear.set(2024);
		component.selectedEnrichmentFilters.set(['WEATHER_ENRICHED', 'OHSOME_ENRICHED']);
		component.applyMapFilters(map);
		expect(map.setLayoutProperty).toHaveBeenCalledWith('preference-avoidance-matched-layer', 'visibility', 'visible');
		expect(map.setLayoutProperty).toHaveBeenCalledWith('preference-avoidance-segments-layer', 'visibility', 'none');
		expect(map.setPaintProperty).not.toHaveBeenCalledWith('preference-avoidance-matched-layer', expect.anything(), expect.anything());
		component.selectedEnrichmentFilters.set([]);
		component.applyMapFilters(map);
		expect(map.setLayoutProperty).toHaveBeenLastCalledWith('preference-avoidance-matched-layer', 'visibility', 'none');
	});

	it('returns to the map and selects a segment from the table', () => {
		jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation((callback) => {
			callback(0);
			return 1;
		});
		component.selectedTab.set('SEGMENTS');

		component.onTableRowSelected(42);

		expect(component.selectedTab()).toBe('MAP');
		expect(component.selectedSegmentId()).toBe(42);
	});

	it('shows every road disruption and includes the ride ID in event details', () => {
		const event = segmentEvent({
			roadDisruptions: [
				{
					factorType: 'CONSTRUCTION',
					source: 'berlin-open-data',
					validFrom: 1_730_780_400_000,
					validTo: 1_730_784_000_000,
					metadata: {
						id: 'construction-1',
						severity: 'DIRECTIONAL_CLOSURE',
						street: 'Invalidenstraße',
						section: 'between A and B',
						content: 'Road works',
					},
				},
				{
					factorType: 'EVENT',
					source: 'berlin-open-data',
					validFrom: 1_730_780_400_000,
					metadata: {
						id: 'event-1',
						street: 'Invalidenstraße',
						content: 'Demonstration',
					},
				},
			],
		});

		expect(component.rideDetailItems(event)).toEqual([
			expect.objectContaining({ label: 'Purpose', value: 'Commute' }),
			expect.objectContaining({ label: 'Bike type', value: 'City Trekking Bike' }),
			expect.objectContaining({ label: 'Ride ID', value: 'ride-1' }),
		]);

		const disruptionRow = component
			.eventConditionRows(event)
			.find((row) => row.label === 'Road disruption');
		expect(disruptionRow?.summary).toBe('2 disruptions');
		expect(disruptionRow?.detailGroups?.map((group) => group.label)).toEqual([
			'Construction site',
			'Disruption',
		]);
		expect(
			disruptionRow?.detailGroups?.flatMap((group) => group.items.map((item) => item.value)),
		).toEqual(
			expect.arrayContaining([
				'One direction closed',
				'Invalidenstraße',
				'Road works',
				'Demonstration',
				'Ongoing',
			]),
		);
		const singleDisruptionRow = component
			.eventConditionRows(
				segmentEvent({
					roadDisruptions: [
						event.roadDisruptions?.[0] as NonNullable<
							SegmentEvent['roadDisruptions']
						>[number],
					],
				}),
			)
			.find((row) => row.label === 'Road disruption');
		expect(singleDisruptionRow?.summary).toBe('Construction site');
		expect(
			singleDisruptionRow?.detailGroups?.[0].items.some(
				(item) => item.label === 'Street' && item.value === 'Invalidenstraße',
			),
		).toBe(true);
		expect(
			component
				.eventConditionRows(segmentEvent())
				.some((row) => row.label === 'Road disruption'),
		).toBe(false);
	});

	it('consolidates infrastructure context and replaces raw absence values with useful copy', () => {
		const event = segmentEvent({
			ohsomeEnriched: true,
			highway: 'FOOTWAY',
			surface: 'PAVING_STONES',
			smoothness: 'GOOD',
			lit: 'YES',
			cyclewayLocation: 'NONE',
		});

		const infrastructureRow = component
			.eventConditionRows(event)
			.find((row) => row.label === 'Infrastructure');
		expect(infrastructureRow?.summary).toBe('Footway · Paving Stones');
		expect(infrastructureRow?.detailGroups?.map((group) => group.label)).toEqual([
			'Path characteristics',
			'Cycling facility',
		]);
		expect(infrastructureRow?.detailGroups?.[0].items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ label: 'Road/path type', value: 'Footway' }),
				expect.objectContaining({ label: 'Surface', value: 'Paving Stones' }),
				expect.objectContaining({ label: 'Smoothness', value: 'Good' }),
				expect.objectContaining({ label: 'Lighting', value: 'Yes' }),
			]),
		);
		expect(infrastructureRow?.detailGroups?.[1].description).toBe(
			'No dedicated cycling facility recorded',
		);
		expect(
			infrastructureRow?.detailGroups?.flatMap((group) =>
				group.items.map((item) => item.value),
			),
		).not.toContain('None');
		expect(component.eventPreviewChips(event)).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ label: 'Path', value: 'Footway' }),
				expect.objectContaining({ label: 'Surface', value: 'Paving Stones' }),
			]),
		);
	});

	it('summarizes a recorded cycling facility with user-facing labels', () => {
		const infrastructureRow = component
			.eventConditionRows(
				segmentEvent({
					ohsomeEnriched: true,
					highway: 'SECONDARY',
					surface: 'ASPHALT',
					cyclewayType: 'LANE',
					cyclewayLocation: 'BOTH',
					cyclewaySurface: 'ASPHALT',
					cyclewayWidth: 1.8,
					bicycleOneway: false,
				}),
			)
			.find((row) => row.label === 'Infrastructure');

		expect(infrastructureRow?.summary).toBe('Cycle lane · Both sides');
		expect(infrastructureRow?.detailGroups?.[1].items).toEqual(
			expect.arrayContaining([
				expect.objectContaining({ label: 'Cycling facility', value: 'Cycle lane' }),
				expect.objectContaining({ label: 'Position', value: 'Both sides' }),
				expect.objectContaining({ label: 'Facility surface', value: 'Asphalt' }),
				expect.objectContaining({ label: 'Width', value: '1.8 m' }),
				expect.objectContaining({ label: 'Cycling direction', value: 'Two-way' }),
			]),
		);
		expect(
			component.rideDetailItems(segmentEvent({ rideId: undefined, rideIntent: 'UNKNOWN' })),
		).toEqual([expect.objectContaining({ label: 'Bike type' })]);
	});

	it('renders road disruption groups in the expanded event card', async () => {
		facade.getSegment.mockReturnValue(
			of({
				id: 42,
				streetName: 'Invalidenstraße',
				usageCount: 20,
				avoidanceCount: 2,
				preferenceCount: 5,
				totalObservationCount: 27,
				incidentCount: 0,
				externalFactors: [],
			}),
		);
		facade.getSegmentEvents.mockReturnValue(
			of([
				segmentEvent({
					ohsomeEnriched: true,
					highway: 'FOOTWAY',
					surface: 'PAVING_STONES',
					cyclewayLocation: 'NONE',
					roadDisruptions: [
						{
							factorType: 'ROAD_CLOSURE',
							source: 'berlin-open-data',
							validFrom: 1_730_780_400_000,
							metadata: {
								id: 'closure-1',
								street: 'Invalidenstraße',
								section: 'between A and B',
								content: 'Full closure',
							},
						},
						{
							factorType: 'EVENT',
							source: 'berlin-open-data',
							validFrom: 1_730_780_400_000,
							metadata: { id: 'event-1', content: 'Demonstration' },
						},
					],
				}),
			]),
		);

		component.selectedPanelView.set('EVENTS');
		component.selectedSegmentId.set(42);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelector('.event-chip-list')).not.toBeNull();
		const eventButton: HTMLButtonElement =
			fixture.nativeElement.querySelector('.event-card__button');
		eventButton.click();
		fixture.detectChanges();

		const expandedCardText = fixture.nativeElement.querySelector('.event-card')
			.textContent as string;
		expect(expandedCardText).toContain('Purpose');
		expect(expandedCardText).toContain('Bike type');
		expect(expandedCardText).toContain('Context at event time');
		expect(expandedCardText).toContain('2 disruptions');
		expect(expandedCardText).not.toContain('Ride id');
		expect(fixture.nativeElement.querySelector('.event-chip-list')).toBeNull();

		const disruptionToggle = [
			...fixture.nativeElement.querySelectorAll('.pa-conditions__toggle'),
		].find((element) =>
			(element.textContent as string).includes('Road disruption'),
		) as HTMLButtonElement;
		disruptionToggle.click();
		fixture.detectChanges();

		const disruptionGroups = fixture.nativeElement.querySelectorAll(
			'.pa-conditions__detail-group',
		);
		expect(disruptionGroups).toHaveLength(2);
		expect(disruptionGroups[0].textContent).toContain('Road closure');
		expect(disruptionGroups[0].textContent).toContain('Full closure');
		expect(disruptionGroups[1].textContent).toContain('Demonstration');
		const wideDetails = [
			...disruptionGroups[0].querySelectorAll('.pa-conditions__detail--wide'),
		].map((element) => element.textContent as string);
		expect(wideDetails).toEqual(
			expect.arrayContaining([
				expect.stringContaining('Street'),
				expect.stringContaining('Section'),
				expect.stringContaining('Description'),
			]),
		);
	});

	it('keeps a corridor highlight when selecting one of its segments', () => {
		jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1);
		component.selectedCorridorSegmentIds.set([41, 42, 43]);

		component.onTableRowSelected(42);

		expect(component.selectedCorridorSegmentIds()).toEqual([41, 42, 43]);
	});

	it('clears a corridor highlight when selecting a segment outside it', () => {
		jest.spyOn(globalThis, 'requestAnimationFrame').mockImplementation(() => 1);
		component.selectedCorridorSegmentIds.set([41, 42, 43]);

		component.onTableRowSelected(99);

		expect(component.selectedCorridorSegmentIds()).toEqual([]);
	});

	it('returns to the map and selects the corridor top segment', () => {
		component.selectedTab.set('ANALYTICS');

		component.onViewCorridorOnMap({
			streetName: 'Invalidenstraße',
			avoidanceRideCount: 10,
			preferenceRideCount: 3,
			avoidanceEventCount: 12,
			preferenceEventCount: 4,
			segmentCount: 2,
			scaryIncidentCount: 1,
			topSegmentId: 99,
			segmentIds: [98, 99, 100],
		});

		expect(component.selectedTab()).toBe('MAP');
		expect(component.selectedSegmentId()).toBe(99);
		expect(component.selectedCorridorSegmentIds()).toEqual([98, 99, 100]);
	});

	it('loads complete corridor geometry and retains every returned street segment', async () => {
		facade.getCorridorGeometry.mockReturnValue(
			of({
				streetName: 'Schönhauser Allee',
				segmentIds: [100, 101, 102],
				geometry: {
					type: 'MultiLineString',
					coordinates: [
						[
							[13.4, 52.52],
							[13.41, 52.53],
						],
					],
				},
			}),
		);

		component.onViewCorridorOnMap({
			streetName: 'Schönhauser Allee',
			avoidanceRideCount: 2,
			preferenceRideCount: 10,
			avoidanceEventCount: 2,
			preferenceEventCount: 12,
			segmentCount: 2,
			scaryIncidentCount: 0,
			minLon: 13.4,
			minLat: 52.52,
			maxLon: 13.42,
			maxLat: 52.54,
			topSegmentId: 100,
			segmentIds: [99, 100],
		});
		await fixture.whenStable();

		expect(facade.getCorridorGeometry).toHaveBeenCalledWith({
			streetName: 'Schönhauser Allee',
			minLon: 13.4,
			minLat: 52.52,
			maxLon: 13.42,
			maxLat: 52.54,
		});
		expect(component.selectedCorridorSegmentIds()).toEqual([99, 100, 101, 102]);
	});

	it('ignores a complete-geometry response after another corridor is selected', async () => {
		const firstResponse = new Subject<ReturnType<typeof completeCorridorGeometry>>();
		const secondResponse = new Subject<ReturnType<typeof completeCorridorGeometry>>();
		facade.getCorridorGeometry
			.mockReturnValueOnce(firstResponse)
			.mockReturnValueOnce(secondResponse);

		component.onViewCorridorOnMap(corridorRanking('First Street', 10, [10]));
		component.onViewCorridorOnMap(corridorRanking('Second Street', 20, [20]));
		secondResponse.next(completeCorridorGeometry('Second Street', [20, 21]));
		secondResponse.complete();
		await fixture.whenStable();
		firstResponse.next(completeCorridorGeometry('First Street', [10, 11]));
		firstResponse.complete();
		await fixture.whenStable();

		expect(component.selectedCorridorSegmentIds()).toEqual([20, 21]);
	});

	it('shows the selected segment identity once and omits duplicate identity metrics', async () => {
		facade.getSegment.mockReturnValue(
			of({
				id: 42,
				streetName: 'Karl-Liebknecht-Straße',
				usageCount: 20,
				avoidanceCount: 2,
				preferenceCount: 5,
				totalObservationCount: 27,
				avoidanceRatio: 0.09,
				preferenceRatio: 0.2,
				incidentCount: 0,
				externalFactors: [],
			}),
		);

		component.selectedSegmentId.set(42);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		const text = fixture.nativeElement.textContent as string;
		expect(text.match(/Karl-Liebknecht-Straße/g)).toHaveLength(1);
		expect(text).toContain('Segment 42');
		expect(text).not.toContain('Segment id');
	});

	it('positions the traffic detector popup at the lowest rendered point of its radius circle', () => {
		const map = {
			project: ([lon, lat]: [number, number]) => ({ x: lon, y: -lat }),
		} as unknown as maplibregl.Map;
		const geometry: Polygon = {
			type: 'Polygon',
			coordinates: [
				[
					[13.4, 52.52],
					[13.41, 52.51],
					[13.42, 52.52],
					[13.4, 52.52],
				],
			],
		};

		const coordinate = component.trafficDetectorPopupCoordinate(map, geometry, [13.41, 52.52]);

		expect(coordinate).toEqual([13.41, 52.51]);
	});
});

function corridorRanking(
	streetName: string,
	topSegmentId: number,
	segmentIds: number[],
): CorridorRanking {
	return {
		streetName,
		avoidanceRideCount: 1,
		preferenceRideCount: 1,
		avoidanceEventCount: 1,
		preferenceEventCount: 1,
		segmentCount: segmentIds.length,
		scaryIncidentCount: 0,
		minLon: 13.4,
		minLat: 52.52,
		maxLon: 13.42,
		maxLat: 52.54,
		topSegmentId,
		segmentIds,
	};
}

function completeCorridorGeometry(streetName: string, segmentIds: number[]) {
	return {
		streetName,
		segmentIds,
		geometry: {
			type: 'MultiLineString' as const,
			coordinates: [
				[
					[13.4, 52.52],
					[13.41, 52.53],
				],
			],
		},
	};
}

function segmentEvent(overrides: Partial<SegmentEvent> = {}): SegmentEvent {
	return {
		id: 'event-1',
		segmentId: 42,
		rideId: 'ride-1',
		eventType: 'PREFERENCE',
		eventTimestamp: 1_730_780_523_456,
		rideIntent: 'COMMUTE',
		bikeType: 'CITY_TREKKING_BIKE',
		weatherEnriched: false,
		ohsomeEnriched: false,
		trafficEnriched: false,
		roadDisruptions: [],
		...overrides,
	};
}
