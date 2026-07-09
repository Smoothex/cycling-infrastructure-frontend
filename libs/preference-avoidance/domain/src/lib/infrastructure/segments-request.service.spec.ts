import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { SegmentsRequestService } from './segments-request.service';

describe('SegmentsRequestService', () => {
	let service: SegmentsRequestService;
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
		service = TestBed.inject(SegmentsRequestService);
	});

	it('should call the tile status endpoint', () => {
		service.getTileStatus();

		expect(httpClientSpy.get).toHaveBeenCalledWith('/api/tiles/status');
	});

	it('should call the segments endpoint with params', () => {
		service.getSegments({ limit: 50, minSampleSize: 1, enrichmentFilters: ['TRAFFIC_ENRICHED', 'WEATHER_ENRICHED'] });

		expect(httpClientSpy.get).toHaveBeenCalledWith('/api/segments', {
			params: { limit: 50, minSampleSize: 1, enrichmentFilters: ['TRAFFIC_ENRICHED', 'WEATHER_ENRICHED'] },
		});
	});

	it('should call the segment detail endpoint', () => {
		service.getSegment(42);

		expect(httpClientSpy.get).toHaveBeenCalledWith('/api/segments/42');
	});

	it('should call the segment events endpoint with params', () => {
		service.getSegmentEvents(42, { limit: 100, eventType: 'AVOIDANCE', enrichmentFilters: [] });

		expect(httpClientSpy.get).toHaveBeenCalledWith('/api/segments/42/events', {
			params: { limit: 100, eventType: 'AVOIDANCE' },
		});
	});
});
