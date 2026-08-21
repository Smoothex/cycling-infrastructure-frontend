import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PreferenceAvoidanceAnalysisFacade } from '@simra/preference-avoidance-domain';
import { of, throwError } from 'rxjs';
import { AnalyticsDashboardComponent } from './analytics-dashboard.component';

describe('AnalyticsDashboardComponent', () => {
	let fixture: ComponentFixture<AnalyticsDashboardComponent>;
	const routeComparisons = {
		classifiedRideCount: 1955,
		detourThresholdRatio: 0.1,
		maximumEquivalentExcessDistanceMeters: 500,
		minimumOverlapRatio: 0.3,
		routeComparisonTypeCounts: {
			EQUIVALENT_ROUTE: 900,
			LOCAL_DETOUR: 496,
			CORRIDOR_ALTERNATIVE: 559,
		},
		detourImpact: [
			{
				routeComparisonType: 'LOCAL_DETOUR',
				eligibleRideCount: 420,
				lowerQuartilePercent: 11.4,
				medianPercent: 14.2,
				upperQuartilePercent: 19.8,
			},
			{
				routeComparisonType: 'CORRIDOR_ALTERNATIVE',
				eligibleRideCount: 501,
				lowerQuartilePercent: 8.6,
				medianPercent: 17.5,
				upperQuartilePercent: 31.3,
			},
		],
	};
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
		getAnalyticsContext: jest.fn().mockReturnValue(
			of({
				matchingRideCount: 1955,
				matchingEventCount: 468711,
				avoidanceEventCount: 171423,
				preferenceEventCount: 297288,
				earliestEventTimestamp: 1615463561000,
				latestEventTimestamp: 1664532378000,
			}),
		),
		getRouteComparisons: jest.fn().mockReturnValue(of(routeComparisons)),
		getCorridors: jest.fn().mockReturnValue(of([corridor])),
		getInfrastructureSignals: jest.fn().mockReturnValue(
			of({
				dimension: 'SURFACE',
				matchingEventCount: 468711,
				knownAttributeEventCount: 201849,
				coverageShare: 0.43,
				baselineAvoidanceShare: 0.36,
				buckets: [
					{
						value: 'sett',
						avoidanceRideCount: 400,
						preferenceRideCount: 250,
						totalRideSignals: 650,
						avoidanceShare: 0.615,
						percentagePointDifference: 25.5,
					},
				],
			}),
		),
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		facade.getAnalyticsContext.mockReturnValue(
			of({
				matchingRideCount: 1955,
				matchingEventCount: 468711,
				avoidanceEventCount: 171423,
				preferenceEventCount: 297288,
				earliestEventTimestamp: 1615463561000,
				latestEventTimestamp: 1664532378000,
			}),
		);
		facade.getRouteComparisons.mockReturnValue(of(routeComparisons));
		facade.getCorridors.mockReturnValue(of([corridor]));
		facade.getInfrastructureSignals.mockReturnValue(
			of({
				dimension: 'SURFACE',
				matchingEventCount: 468711,
				knownAttributeEventCount: 201849,
				coverageShare: 0.43,
				baselineAvoidanceShare: 0.36,
				buckets: [
					{
						value: 'sett',
						avoidanceRideCount: 400,
						preferenceRideCount: 250,
						totalRideSignals: 650,
						avoidanceShare: 0.615,
						percentagePointDifference: 25.5,
					},
				],
			}),
		);
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
		expect(text).toContain('Route comparison types');
		expect(text).toContain('Within distance tolerance');
		expect(text).toContain('900');
		expect(text).toContain('Detour impact');
		expect(text).toContain('Local detour: median +14.2%');
		expect(text).toContain('absolute excess exceeds 500 m');
		expect(
			fixture.nativeElement.querySelectorAll('.pa-analytics__comparison-grid > p-card'),
		).toHaveLength(2);
	});

	it('maps quartiles to collapsed-whisker box plots and configures the relative limit', async () => {
		await createComponent();
		const component = fixture.componentInstance as unknown as {
			detourImpactChartData: () => {
				labels: string[];
				datasets: { data: unknown[]; backgroundColor: string[] }[];
			};
			detourImpactChartOptions: () => {
				plugins: { annotation: { annotations: Record<string, unknown> } };
			};
		};

		expect(component.detourImpactChartData()).toMatchObject({
			labels: ['Local detour', 'Corridor alternative'],
			datasets: [
				{
					data: [
						{ min: 11.4, q1: 11.4, median: 14.2, q3: 19.8, max: 19.8 },
						{ min: 8.6, q1: 8.6, median: 17.5, q3: 31.3, max: 31.3 },
					],
					backgroundColor: ['#d97706cc', '#7c3aedcc'],
				},
			],
		});
		expect(component.detourImpactChartOptions().plugins.annotation.annotations).toMatchObject({
			detourThreshold: {
				type: 'line',
				xMin: 10,
				xMax: 10,
				borderDash: [5, 5],
				label: { content: '10% relative limit' },
			},
		});
	});

	it('reloads route comparisons when the global analytics filters change', async () => {
		fixture = TestBed.createComponent(AnalyticsDashboardComponent);
		fixture.componentRef.setInput('filters', {});
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.componentRef.setInput('filters', { from: 1000, to: 2000, rideIntent: 'COMMUTE' });
		fixture.detectChanges();
		await fixture.whenStable();

		expect(facade.getRouteComparisons).toHaveBeenLastCalledWith({
			from: 1000,
			to: 2000,
			rideIntent: 'COMMUTE',
		});
	});

	it('shows an empty route-comparison state without hiding other analytics', async () => {
		facade.getRouteComparisons.mockReturnValue(
			of({
				classifiedRideCount: 0,
				detourThresholdRatio: 0.1,
				maximumEquivalentExcessDistanceMeters: 500,
				minimumOverlapRatio: 0.3,
				routeComparisonTypeCounts: {
					EQUIVALENT_ROUTE: 0,
					LOCAL_DETOUR: 0,
					CORRIDOR_ALTERNATIVE: 0,
				},
				detourImpact: [],
			}),
		);

		await createComponent();

		const text = fixture.nativeElement.textContent;
		expect(text).toContain('No classified rides match the selected year and ride type.');
		expect(text).toContain('At least 10 rides with usable distance measurements are required');
		expect(text).toContain('Top avoided streets');
	});

	it('plots only detour types meeting the sample threshold and identifies the omitted type', async () => {
		facade.getRouteComparisons.mockReturnValue(
			of({
				...routeComparisons,
				detourImpact: [
					{ ...routeComparisons.detourImpact[0], eligibleRideCount: 10 },
					{ ...routeComparisons.detourImpact[1], eligibleRideCount: 9 },
				],
			}),
		);

		await createComponent();

		const text = fixture.nativeElement.textContent;
		const component = fixture.componentInstance as unknown as {
			detourImpactChartData: () => { labels: string[] };
		};
		expect(component.detourImpactChartData().labels).toEqual(['Local detour']);
		expect(text).toContain(
			'Corridor alternative is not shown because fewer than 10 eligible rides are available.',
		);
		expect(text).toContain('10 eligible rides');
	});

	it('keeps route counts visible when detour-impact samples are insufficient', async () => {
		facade.getRouteComparisons.mockReturnValue(
			of({
				...routeComparisons,
				detourImpact: routeComparisons.detourImpact.map((item) => ({
					...item,
					eligibleRideCount: 9,
				})),
			}),
		);

		await createComponent();

		const text = fixture.nativeElement.textContent;
		expect(text).toContain('1,955');
		expect(text).toContain('At least 10 rides with usable distance measurements are required');
		expect(fixture.nativeElement.querySelector('.pa-detour-impact__chart')).toBeNull();
	});

	it('shows a route-comparison error without hiding other analytics', async () => {
		facade.getRouteComparisons.mockReturnValue(
			throwError(() => new Error('route comparisons failed')),
		);

		await createComponent();

		const text = fixture.nativeElement.textContent;
		expect(text).toContain('Route comparison counts could not be loaded.');
		expect(text).toContain('Detour impact could not be loaded.');
		expect(text).toContain('Top avoided streets');
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
