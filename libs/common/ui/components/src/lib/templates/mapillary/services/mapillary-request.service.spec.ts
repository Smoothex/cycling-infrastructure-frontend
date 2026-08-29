import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { MapillaryRequestService } from './mapillary-request.service';

describe('MapillaryRequestService', () => {
	let service: MapillaryRequestService;
	let httpTestingController: HttpTestingController;

	beforeEach(() => {
		TestBed.configureTestingModule({
			providers: [provideHttpClient(), provideHttpClientTesting()],
		});
		service = TestBed.inject(MapillaryRequestService);
		httpTestingController = TestBed.inject(HttpTestingController);
	});

	afterEach(() => httpTestingController.verify());

	it('keeps a substantially closer image when a newer image is too far away', async () => {
		const resultPromise = firstValueFrom(service.findNearestImage(52.52, 13.405));
		const request = httpTestingController.expectOne((candidate) =>
			candidate.url.endsWith('/mapillary/images'),
		);

		expect(request.request.params.get('fields')).toBe(
			'id,captured_at,geometry,computed_geometry',
		);
		expect(request.request.params.get('limit')).toBe('2000');
		expect(request.request.params.has('start_captured_at')).toBe(false);
		request.flush({
			data: [
				{
					id: 'farther',
					captured_at: '2025-01-01T00:00:00Z',
					geometry: { type: 'Point', coordinates: [13.4052, 52.52] },
				},
				{
					id: 'nearest',
					captured_at: '2024-01-01T00:00:00Z',
					geometry: { type: 'Point', coordinates: [13.40501, 52.52] },
				},
			],
		});

		await expect(resultPromise).resolves.toMatchObject({
			id: 'nearest',
			temporalMatch: 'IN_RANGE',
		});
	});

	it('prefers a newer image when it is still spatially close to the segment', async () => {
		const resultPromise = firstValueFrom(service.findNearestImage(52.52, 13.405));
		const request = httpTestingController.expectOne((candidate) =>
			candidate.url.endsWith('/mapillary/images'),
		);

		request.flush({
			data: [
				{
					id: 'older-nearest',
					captured_at: '2022-05-11T00:00:00Z',
					geometry: { type: 'Point', coordinates: [13.40501, 52.52] },
				},
				{
					id: 'newer-nearby',
					captured_at: '2025-09-16T00:00:00Z',
					geometry: { type: 'Point', coordinates: [13.4051, 52.52] },
				},
			],
		});

		await expect(resultPromise).resolves.toMatchObject({
			id: 'newer-nearby',
			capturedAt: '2025-09-16T00:00:00.000Z',
			temporalMatch: 'IN_RANGE',
		});
	});

	it('filters by capture year and falls back to the temporally closest image', async () => {
		const from = new Date('2022-01-01T00:00:00.000Z');
		const to = new Date('2022-12-31T23:59:59.999Z');
		const resultPromise = firstValueFrom(
			service.findNearestImage(52.52, 13.405, {
				from,
				to,
				fallbackToNearestDate: true,
			}),
		);

		const yearRequest = httpTestingController.expectOne((candidate) =>
			candidate.params.has('start_captured_at'),
		);
		expect(yearRequest.request.params.get('start_captured_at')).toBe(from.toISOString());
		expect(yearRequest.request.params.get('end_captured_at')).toBe(to.toISOString());
		yearRequest.flush({ data: [] });

		const fallbackRequest = httpTestingController.expectOne(
			(candidate) => !candidate.params.has('start_captured_at'),
		);
		fallbackRequest.flush({
			data: [
				{
					id: 'older',
					captured_at: '2021-12-20T00:00:00Z',
					geometry: { type: 'Point', coordinates: [13.40501, 52.52] },
				},
				{
					id: 'newer',
					captured_at: '2023-03-01T00:00:00Z',
					geometry: { type: 'Point', coordinates: [13.405, 52.52] },
				},
			],
		});

		await expect(resultPromise).resolves.toMatchObject({
			id: 'older',
			temporalMatch: 'NEAREST_DATE',
			capturedAt: '2021-12-20T00:00:00.000Z',
		});
	});

	it('selects the closest image captured inside the requested year without falling back', async () => {
		const resultPromise = firstValueFrom(
			service.findNearestImage(52.52, 13.405, {
				from: new Date('2024-01-01T00:00:00.000Z'),
				to: new Date('2024-12-31T23:59:59.999Z'),
				fallbackToNearestDate: true,
			}),
		);

		const request = httpTestingController.expectOne((candidate) =>
			candidate.params.has('start_captured_at'),
		);
		request.flush({
			data: [
				{
					id: 'in-year',
					captured_at: 1_719_792_000_000,
					geometry: { type: 'Point', coordinates: [13.40501, 52.52] },
				},
			],
		});

		await expect(resultPromise).resolves.toMatchObject({
			id: 'in-year',
			temporalMatch: 'IN_RANGE',
			capturedAt: '2024-07-01T00:00:00.000Z',
		});
	});

	it('returns undefined when neither the selected year nor the fallback has imagery', async () => {
		const resultPromise = firstValueFrom(
			service.findNearestImage(52.52, 13.405, {
				from: new Date('2020-01-01T00:00:00.000Z'),
				to: new Date('2020-12-31T23:59:59.999Z'),
				fallbackToNearestDate: true,
			}),
		);

		httpTestingController
			.expectOne((candidate) => candidate.params.has('start_captured_at'))
			.flush({ data: [] });
		httpTestingController
			.expectOne((candidate) => !candidate.params.has('start_captured_at'))
			.flush({ data: [] });

		await expect(resultPromise).resolves.toBeUndefined();
	});
});
