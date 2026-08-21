import { HttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { RouteReviewRequestService } from './route-review-request.service';

describe('RouteReviewRequestService', () => {
	let service: RouteReviewRequestService;
	let httpClientSpy: { get: jest.Mock; put: jest.Mock };

	beforeEach(() => {
		httpClientSpy = {
			get: jest.fn().mockReturnValue(of({})),
			put: jest.fn().mockReturnValue(of({})),
		};
		TestBed.configureTestingModule({
			providers: [{ provide: HttpClient, useValue: httpClientSpy }],
		});
		service = TestBed.inject(RouteReviewRequestService);
	});

	it('loads the fixed review sample', () => {
		service.getSample();

		expect(httpClientSpy.get).toHaveBeenCalledWith('/api/route-comparisons/review-sample');
	});

	it('loads detail only for a sampled ride', () => {
		service.getDetail('ride-1');

		expect(httpClientSpy.get).toHaveBeenCalledWith(
			'/api/route-comparisons/review-sample/ride-1',
		);
	});

	it('persists the manual decision independently from the automated class', () => {
		const request = {
			manualClassification: 'UNCERTAIN' as const,
			issueCodes: ['POOR_GPS_QUALITY' as const],
			notes: 'GPS trace is offset.',
		};

		service.saveReview('ride-1', request);

		expect(httpClientSpy.put).toHaveBeenCalledWith(
			'/api/route-comparisons/review-sample/ride-1/review',
			request,
		);
	});
});
