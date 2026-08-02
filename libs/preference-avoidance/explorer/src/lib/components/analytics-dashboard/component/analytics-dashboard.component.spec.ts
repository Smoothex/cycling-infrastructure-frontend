import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PreferenceAvoidanceAnalysisFacade } from '@simra/preference-avoidance-domain';
import { of, throwError } from 'rxjs';
import { AnalyticsDashboardComponent } from './analytics-dashboard.component';

describe('AnalyticsDashboardComponent', () => {
	let fixture: ComponentFixture<AnalyticsDashboardComponent>;
	const corridor = {
		streetName: 'Chausseestraße',
		avoidanceRideCount: 134,
		preferenceRideCount: 80,
		avoidanceEventCount: 1491,
		preferenceEventCount: 600,
		segmentCount: 42,
		scaryIncidentCount: 68,
		topSegmentId: 123,
		segmentIds: [121, 122, 123],
	};
	const facade = {
		getAnalyticsContext: jest.fn().mockReturnValue(of({
			matchingRideCount: 1955,
			matchingEventCount: 468711,
			avoidanceEventCount: 171423,
			preferenceEventCount: 297288,
			earliestEventTimestamp: 1615463561000,
			latestEventTimestamp: 1664532378000,
		})),
		getCorridors: jest.fn().mockReturnValue(of([corridor])),
		getInfrastructureSignals: jest.fn().mockReturnValue(of({
			dimension: 'SURFACE',
			matchingEventCount: 468711,
			knownAttributeEventCount: 201849,
			coverageShare: 0.43,
			baselineAvoidanceShare: 0.36,
			buckets: [{
				value: 'sett',
				avoidanceRideCount: 400,
				preferenceRideCount: 250,
				totalRideSignals: 650,
				avoidanceShare: 0.615,
				percentagePointDifference: 25.5,
			}],
		})),
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		facade.getAnalyticsContext.mockReturnValue(of({
			matchingRideCount: 1955,
			matchingEventCount: 468711,
			avoidanceEventCount: 171423,
			preferenceEventCount: 297288,
			earliestEventTimestamp: 1615463561000,
			latestEventTimestamp: 1664532378000,
		}));
		facade.getCorridors.mockReturnValue(of([corridor]));
		facade.getInfrastructureSignals.mockReturnValue(of({
			dimension: 'SURFACE',
			matchingEventCount: 468711,
			knownAttributeEventCount: 201849,
			coverageShare: 0.43,
			baselineAvoidanceShare: 0.36,
			buckets: [{
				value: 'sett',
				avoidanceRideCount: 400,
				preferenceRideCount: 250,
				totalRideSignals: 650,
				avoidanceShare: 0.615,
				percentagePointDifference: 25.5,
			}],
		}));
		await TestBed.configureTestingModule({
			imports: [AnalyticsDashboardComponent],
			providers: [{ provide: PreferenceAvoidanceAnalysisFacade, useValue: facade }],
		}).compileComponents();
	});

	async function createComponent(): Promise<void> {
		fixture = TestBed.createComponent(AnalyticsDashboardComponent);
		fixture.componentRef.setInput('filters', {});
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
	}

	it('renders the compact evidence context and the retained corridor insights', async () => {
		await createComponent();
		const text = fixture.nativeElement.textContent;

		expect(text).toContain('1,955');
		expect(text).toContain('Top avoided streets');
		expect(text).toContain('Top preferred streets');
		expect(text).toContain('Chausseestraße');
		expect(text).toContain('Infrastructure signals');
	});

	it('emits the selected corridor when its map action is used', async () => {
		await createComponent();
		const emitted: unknown[] = [];
		fixture.componentInstance.viewCorridorOnMap.subscribe((value) => emitted.push(value));
		const button: HTMLButtonElement = fixture.nativeElement.querySelector('.corridor-map-link');

		button.click();

		expect(emitted).toEqual([corridor]);
	});

	it('shows an avoided-corridor error without hiding preferred results', async () => {
		facade.getCorridors
			.mockReturnValueOnce(throwError(() => new Error('avoided request failed')))
			.mockReturnValueOnce(of([corridor]));

		await createComponent();

		const text = fixture.nativeElement.textContent;
		expect(text).toContain('Avoided streets could not be loaded.');
		expect(text).toContain('Top preferred streets');
		expect(text).toContain('Chausseestraße');
		expect(text).not.toContain('No avoided street has enough rides');
	});

	it('shows a preferred-corridor error without hiding avoided results', async () => {
		facade.getCorridors
			.mockReturnValueOnce(of([corridor]))
			.mockReturnValueOnce(throwError(() => new Error('preferred request failed')));

		await createComponent();

		const text = fixture.nativeElement.textContent;
		expect(text).toContain('Preferred streets could not be loaded.');
		expect(text).toContain('Top avoided streets');
		expect(text).toContain('Chausseestraße');
		expect(text).not.toContain('No preferred street has enough rides');
	});

	it('shows empty messages only after successful empty corridor responses', async () => {
		facade.getCorridors.mockReturnValue(of([]));

		await createComponent();

		const text = fixture.nativeElement.textContent;
		expect(text).toContain('No avoided street has enough rides');
		expect(text).toContain('No preferred street has enough rides');
		expect(text).not.toContain('could not be loaded');
	});
});
