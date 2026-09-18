import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { AnalyticsRequestService } from './analytics-request.service';

describe('AnalyticsRequestService', () => {
	let service: AnalyticsRequestService;
	let httpClientSpy: { get: jest.Mock };

	beforeEach(() => {
		httpClientSpy = { get: jest.fn().mockReturnValue(of({})) };
		TestBed.configureTestingModule({
			providers: [
				{
					provide: HttpClient,
					useValue: httpClientSpy,
				},
			],
		});
		service = TestBed.inject(AnalyticsRequestService);
	});

	it('should call the summary endpoint', () => {
		service.getSummary();

		expect(httpClientSpy.get).toHaveBeenCalledWith('/api/analytics/summary');
	});

	it('should fetch both dropdowns through the filter-options endpoint', () => {
		service.getFilterOptions();

		expect(httpClientSpy.get).toHaveBeenCalledWith('/api/analytics/filter-options');
	});

	it('should call the distribution endpoint with params', () => {
		service.getDistribution({ dimension: 'EVENT_TYPE', limit: 12 });

		expect(httpClientSpy.get).toHaveBeenCalledWith('/api/analytics/distribution', {
			params: { dimension: 'EVENT_TYPE', limit: 12 },
		});
	});

	it('should call the filter-aware context endpoint', () => {
		service.getContext({ from: 1000, rideIntent: 'COMMUTE' });

		expect(httpClientSpy.get).toHaveBeenCalledWith('/api/analytics/context', {
			params: { from: 1000, rideIntent: 'COMMUTE' },
		});
	});

	it('should call the filter-aware route-comparisons endpoint', () => {
		service.getRouteComparisons({ from: 1000, to: 2000, rideIntent: 'COMMUTE' });

		expect(httpClientSpy.get).toHaveBeenCalledWith('/api/analytics/route-comparisons', {
			params: { from: 1000, to: 2000, rideIntent: 'COMMUTE' },
		});
	});

	it('should call the corridors endpoint with ranking params', () => {
		service.getCorridors({ rank: 'AVOIDANCE', limit: 8, minRideCount: 5 });

		expect(httpClientSpy.get).toHaveBeenCalledWith('/api/analytics/corridors', {
			params: { rank: 'AVOIDANCE', limit: 8, minRideCount: 5 },
		});
	});

	it('should call the corridor geometry endpoint with the selected bounds', () => {
		service.getCorridorGeometry({
			streetName: 'Schönhauser Allee',
			minLon: 13.4,
			minLat: 52.52,
			maxLon: 13.43,
			maxLat: 52.55,
		});

		expect(httpClientSpy.get).toHaveBeenCalledWith('/api/analytics/corridor-geometry', {
			params: {
				streetName: 'Schönhauser Allee',
				minLon: 13.4,
				minLat: 52.52,
				maxLon: 13.43,
				maxLat: 52.55,
			},
		});
	});

	it('should call the infrastructure-signals endpoint', () => {
		service.getInfrastructureSignals({ dimension: 'SMOOTHNESS', minRideCount: 20 });

		expect(httpClientSpy.get).toHaveBeenCalledWith('/api/analytics/infrastructure-signals', {
			params: { dimension: 'SMOOTHNESS', minRideCount: 20 },
		});
	});

	it('should strip empty array params from generic distributions', () => {
		service.getDistribution({ dimension: 'SURFACE', enrichmentFilters: [] });

		expect(httpClientSpy.get).toHaveBeenCalledWith('/api/analytics/distribution', {
			params: { dimension: 'SURFACE' },
		});
	});
});
