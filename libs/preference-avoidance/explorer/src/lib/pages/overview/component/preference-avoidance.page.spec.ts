import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Component, input, output, WritableSignal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { MapPage } from '@simra/common-components';
import { APP_CONFIG } from '@simra/common-models';
import { CorridorRanking, SegmentEnrichmentFilter } from '@simra/preference-avoidance-common';
import { PreferenceAvoidanceAnalysisFacade } from '@simra/preference-avoidance-domain';
import { Polygon } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import { of, Subject } from 'rxjs';
import { PreferenceAvoidancePage } from './preference-avoidance.page';

type ExplorerTab = 'MAP' | 'ANALYTICS' | 'SEGMENTS';

@Component({
	selector: 't-map-component',
	standalone: true,
	template: '',
})
class MapPageStubComponent {
	readonly isNavigable = input(false);
	readonly mapReady = output<never>();
}

interface TestablePreferenceAvoidancePage {
	selectedYear: WritableSignal<number | undefined>;
	selectedRideIntent: WritableSignal<string | undefined>;
	selectedTrafficCondition: WritableSignal<string | undefined>;
	selectedEnrichmentFilters: WritableSignal<SegmentEnrichmentFilter[]>;
	selectedRiskLegendBuckets: WritableSignal<string[]>;
	selectedTab: WritableSignal<ExplorerTab>;
	selectedSegmentId: WritableSignal<number | undefined>;
	selectedCorridorSegmentIds: WritableSignal<number[]>;
	onClearAllFilters(): void;
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
		getSummary: jest.fn().mockReturnValue(of({
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
		})),
		getSegments: jest.fn().mockReturnValue(of([])),
		getTileStatus: jest.fn().mockReturnValue(of(undefined)),
		getTrafficDetectors: jest.fn().mockReturnValue(of(undefined)),
		getNearMissIncidents: jest.fn().mockReturnValue(of([])),
		getRoadClosures: jest.fn().mockReturnValue(of([])),
		getSegment: jest.fn().mockReturnValue(of(undefined)),
		getSegmentEvents: jest.fn().mockReturnValue(of([])),
		getDistribution: jest.fn().mockReturnValue(of([])),
		getSegmentsGeoJson: jest.fn().mockReturnValue(of({ type: 'FeatureCollection', features: [] })),
		getCorridorGeometry: jest.fn().mockReturnValue(of({
			streetName: 'Schönhauser Allee',
			segmentIds: [],
			geometry: { type: 'MultiLineString', coordinates: [] },
		})),
	};

	beforeEach(async () => {
		jest.clearAllMocks();
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
				remove: { imports: [MapPage] },
				add: { imports: [MapPageStubComponent] },
			})
			.compileComponents();

		fixture = TestBed.createComponent(PreferenceAvoidancePage);
		component = fixture.componentInstance as unknown as TestablePreferenceAvoidancePage;
		fixture.detectChanges();
		await fixture.whenStable();
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
		const clearButton: HTMLButtonElement = fixture.nativeElement.querySelector('.pa-global-filters__clear');
		expect(clearButton.disabled).toBe(true);
		expect(fixture.nativeElement.textContent).not.toContain('Min incidents');

		component.selectedYear.set(2024);
		component.selectedRideIntent.set('COMMUTE');
		component.selectedTrafficCondition.set('HEAVY');
		component.selectedEnrichmentFilters.set(['OHSOME_ENRICHED']);
		fixture.detectChanges();

		expect(fixture.nativeElement.querySelectorAll('.filter-control--active')).toHaveLength(3);
		expect(fixture.nativeElement.querySelector('.pa-enrichment-chip--selected .ph-check')).not.toBeNull();
		expect(clearButton.disabled).toBe(false);
	});

	it('passes active filters to aggregate segment requests without per-segment qualification calls', async () => {
		component.selectedYear.set(2024);
		component.selectedRideIntent.set('COMMUTE');
		component.selectedTrafficCondition.set('CONGESTED');
		component.selectedEnrichmentFilters.set(['TRAFFIC_MEASURED']);

		fixture.detectChanges();
		await fixture.whenStable();

		const expectedFilters = expect.objectContaining({
			from: Date.UTC(2024, 0, 1),
			to: Date.UTC(2025, 0, 1) - 1,
			rideIntent: 'COMMUTE',
			trafficCondition: 'CONGESTED',
			enrichmentFilters: ['TRAFFIC_MEASURED'],
		});
		expect(facade.getSegments).toHaveBeenLastCalledWith(expectedFilters);
		expect(facade.getSegmentsGeoJson).toHaveBeenLastCalledWith(expectedFilters);
		expect(facade.getSegmentEvents).not.toHaveBeenCalled();
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
		facade.getCorridorGeometry.mockReturnValue(of({
			streetName: 'Schönhauser Allee',
			segmentIds: [100, 101, 102],
			geometry: {
				type: 'MultiLineString',
				coordinates: [[[13.4, 52.52], [13.41, 52.53]]],
			},
		}));

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
		facade.getSegment.mockReturnValue(of({
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
		}));

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
			coordinates: [[
				[13.4, 52.52],
				[13.41, 52.51],
				[13.42, 52.52],
				[13.4, 52.52],
			]],
		};

		const coordinate = component.trafficDetectorPopupCoordinate(map, geometry, [13.41, 52.52]);

		expect(coordinate).toEqual([13.41, 52.51]);
	});
});

function corridorRanking(streetName: string, topSegmentId: number, segmentIds: number[]): CorridorRanking {
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
			coordinates: [[[13.4, 52.52], [13.41, 52.53]]],
		},
	};
}
