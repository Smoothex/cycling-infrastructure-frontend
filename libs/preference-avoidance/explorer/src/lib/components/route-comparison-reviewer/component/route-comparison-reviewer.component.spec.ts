import { Component, input, output, WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MapPage } from '@simra/common-components';
import { APP_CONFIG } from '@simra/common-models';
import {
	ManualRouteComparisonClassification,
	RouteReviewSample,
} from '@simra/preference-avoidance-common';
import { PreferenceAvoidanceAnalysisFacade } from '@simra/preference-avoidance-domain';
import { of, throwError } from 'rxjs';
import { RouteComparisonReviewerComponent } from './route-comparison-reviewer.component';

@Component({
	selector: 't-map-component',
	standalone: true,
	template: '',
})
class MapPageStubComponent {
	readonly isNavigable = input(false);
	readonly mapReady = output<never>();
}

interface TestableReviewer {
	mode: WritableSignal<'EXPLORE' | 'REVIEW'>;
	selectedRideId: WritableSignal<string | undefined>;
	rideIdQuery: WritableSignal<string>;
	rideIdLookupError: WritableSignal<string | undefined>;
	manualClassification: WritableSignal<ManualRouteComparisonClassification | undefined>;
	onModeChange(mode: 'EXPLORE' | 'REVIEW'): void;
	onRideIdQueryChange(value: string): void;
	onRideIdLookup(): void;
	onReturnToSample(): void;
	onManualClassificationChange(classification: ManualRouteComparisonClassification): void;
	onSaveReview(): Promise<void>;
}

const firstRideId = 'cc1ad428-a775-4aef-b069-2e4a4ce1833f';
const secondRideId = '9ed969ff-5d38-4474-a00f-35f63a532d3a';
const directLookupRideId = '45997139-624d-405d-870a-83d0ce77e624';
const missingRideId = '11111111-2222-3333-4444-555555555555';

const sample: RouteReviewSample = {
	sampleSizePerType: 30,
	totalItems: 2,
	reviewedItems: 0,
	representativeOfPrevalence: false,
	items: [
		{
			rideId: firstRideId,
			sampleOrder: 1,
			classSampleRank: 1,
			automatedClassification: 'LOCAL_DETOUR',
			actualDistanceMeters: 1_200,
			shortestPathDistanceMeters: 1_000,
			absoluteExcessDistanceMeters: 200,
			relativeDetourRatio: 0.2,
			overlapRatio: 0.55,
		},
		{
			rideId: secondRideId,
			sampleOrder: 2,
			classSampleRank: 2,
			automatedClassification: 'LOCAL_DETOUR',
			actualDistanceMeters: 1_100,
			shortestPathDistanceMeters: 1_000,
			absoluteExcessDistanceMeters: 100,
			relativeDetourRatio: 0.1,
			overlapRatio: 0.7,
		},
	],
};

const routeDetail = (rideId: string) => {
	const item = sample.items.find((candidate) => candidate.rideId === rideId) ?? {
		...sample.items[0],
		rideId,
		sampleOrder: 0,
		classSampleRank: 0,
	};
	return of({
		...item,
		detourThresholdRatio: 0.1,
		maximumEquivalentExcessDistanceMeters: 500,
		minimumOverlapRatio: 0.3,
		observedRoute: {
			type: 'LineString' as const,
			coordinates: [
				[13.4, 52.5],
				[13.5, 52.6],
			],
		},
		shortestRoute: {
			type: 'LineString' as const,
			coordinates: [
				[13.4, 52.5],
				[13.45, 52.55],
			],
		},
		signals: [],
	});
};

describe('RouteComparisonReviewerComponent', () => {
	let fixture: ComponentFixture<RouteComparisonReviewerComponent>;
	let component: TestableReviewer;
	const facade = {
		getRouteReviewSample: jest.fn().mockReturnValue(of(sample)),
		getRouteReviewDetail: jest.fn().mockImplementation(routeDetail),
		getRouteComparisonDetail: jest.fn().mockImplementation(routeDetail),
		saveRouteReview: jest.fn().mockReturnValue(
			of({
				manualClassification: 'LOCAL_DETOUR',
				issueCodes: [],
				reviewedAt: 1_700_000_000_000,
			}),
		),
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		await TestBed.configureTestingModule({
			imports: [RouteComparisonReviewerComponent],
			providers: [
				provideRouter([]),
				{ provide: PreferenceAvoidanceAnalysisFacade, useValue: facade },
				{ provide: APP_CONFIG, useValue: { mapTilerToken: 'test-token' } },
			],
		})
			.overrideComponent(RouteComparisonReviewerComponent, {
				remove: { imports: [MapPage] },
				add: { imports: [MapPageStubComponent] },
			})
			.compileComponents();

		fixture = TestBed.createComponent(RouteComparisonReviewerComponent);
		component = fixture.componentInstance as unknown as TestableReviewer;
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
	});

	it('defaults to explore and labels results as manual-review agreement', async () => {
		await fixture.whenStable();
		fixture.detectChanges();
		const text = fixture.nativeElement.textContent.replace(/\s+/g, ' ');

		expect(component.mode()).toBe('EXPLORE');
		expect(text).toContain('Manual-review agreement');
		expect(text).toContain('not representative of class prevalence');
		expect(text).toContain('Within distance tolerance');
		expect(text).toContain('Absolute excess limit: 500 m');
		expect(text).toContain('Ride ID');
		expect(text).toContain('#1');
	});

	it('loads a processed ride directly by UUID', async () => {
		component.onRideIdQueryChange(directLookupRideId);
		component.onRideIdLookup();
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		expect(component.selectedRideId()).toBe(directLookupRideId);
		expect(facade.getRouteComparisonDetail).toHaveBeenLastCalledWith(directLookupRideId);
		expect(fixture.nativeElement.textContent).toContain('Direct lookup');
	});

	it('rejects an invalid ride ID without starting a lookup', () => {
		component.onRideIdQueryChange('not-a-uuid');
		component.onRideIdLookup();

		expect(component.rideIdLookupError()).toBe('Enter a complete ride ID in UUID format.');
		expect(component.selectedRideId()).toBe(firstRideId);
		expect(facade.getRouteComparisonDetail).not.toHaveBeenCalled();
	});

	it('reports when a ride has no completed route comparison', async () => {
		facade.getRouteComparisonDetail.mockReturnValueOnce(
			throwError(() => new Error('Not found')),
		);

		component.onRideIdQueryChange(missingRideId);
		component.onRideIdLookup();
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		expect(component.rideIdLookupError()).toBe(
			'Ride not found or it has no completed route comparison.',
		);
		expect(fixture.nativeElement.textContent).toContain(
			'Ride not found or it has no completed route comparison.',
		);
	});

	it('returns from a direct lookup to the fixed sample', async () => {
		component.onRideIdQueryChange(directLookupRideId);
		component.onRideIdLookup();
		component.onReturnToSample();
		fixture.detectChanges();
		await fixture.whenStable();

		expect(component.selectedRideId()).toBe(firstRideId);
	});

	it('saves a review and immediately advances to the next unreviewed route', async () => {
		component.onModeChange('REVIEW');
		component.onManualClassificationChange('LOCAL_DETOUR');

		await component.onSaveReview();

		expect(facade.saveRouteReview).toHaveBeenCalledWith(
			firstRideId,
			expect.objectContaining({ manualClassification: 'LOCAL_DETOUR' }),
		);
		expect(component.selectedRideId()).toBe(secondRideId);
	});
});
