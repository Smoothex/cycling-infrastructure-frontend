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

	it('should call the distribution endpoint with params', () => {
		service.getDistribution({ dimension: 'EVENT_TYPE', limit: 12 });

		expect(httpClientSpy.get).toHaveBeenCalledWith('/api/analytics/distribution', {
			params: { dimension: 'EVENT_TYPE', limit: 12 },
		});
	});

	it('should call the time-series endpoint with params', () => {
		service.getTimeSeries({ bucket: 'MONTH' });

		expect(httpClientSpy.get).toHaveBeenCalledWith('/api/analytics/time-series', {
			params: { bucket: 'MONTH' },
		});
	});
});
