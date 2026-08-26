import { ComponentFixture, TestBed } from '@angular/core/testing';
import { APP_CONFIG } from '@simra/common-models';
import { Viewer, type ViewerImageEvent } from 'mapillary-js';
import { of, throwError } from 'rxjs';
import {
	MapillaryImageMatch,
	MapillaryRequestService,
} from '../services/mapillary-request.service';
import { MapillaryViewerComponent } from './mapillary-viewer.component';

const mockMoveTo = jest.fn().mockResolvedValue(undefined);
const mockRemove = jest.fn();
const mockOff = jest.fn();
let mockImageHandler: ((event: ViewerImageEvent) => void) | undefined;
const mockOn = jest.fn((type: string, handler: (event: ViewerImageEvent) => void): void => {
	if (type === 'image') {
		mockImageHandler = handler;
	}
});

jest.mock('mapillary-js', () => ({
	Viewer: jest.fn().mockImplementation(() => ({
		moveTo: mockMoveTo,
		on: mockOn,
		off: mockOff,
		remove: mockRemove,
	})),
}));

describe('MapillaryViewerComponent', () => {
	let fixture: ComponentFixture<MapillaryViewerComponent>;
	const requestService = {
		findNearestImage: jest.fn(),
	};

	beforeEach(async () => {
		jest.clearAllMocks();
		mockImageHandler = undefined;
		await TestBed.configureTestingModule({
			imports: [MapillaryViewerComponent],
			providers: [
				{ provide: MapillaryRequestService, useValue: requestService },
				{ provide: APP_CONFIG, useValue: { mapillaryAccessToken: 'test-token' } },
			],
		}).compileComponents();

		fixture = TestBed.createComponent(MapillaryViewerComponent);
		fixture.detectChanges();
		Object.defineProperty(
			fixture.nativeElement.querySelector('.mapillary-container'),
			'clientWidth',
			{ configurable: true, value: 400 },
		);
		Object.defineProperty(
			fixture.nativeElement.querySelector('.mapillary-container'),
			'clientHeight',
			{ configurable: true, value: 320 },
		);
	});

	it('shows and labels a nearest-date fallback for a selected year', async () => {
		const match: MapillaryImageMatch = {
			id: 'image-1',
			coordinates: [13.405, 52.52],
			capturedAt: '2021-12-20T00:00:00.000Z',
			temporalMatch: 'NEAREST_DATE',
		};
		requestService.findNearestImage.mockReturnValue(of(match));

		fixture.componentRef.setInput('latitude', 52.52);
		fixture.componentRef.setInput('longitude', 13.405);
		fixture.componentRef.setInput('year', 2022);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		expect(fixture.nativeElement.textContent).toContain('No nearby imagery from 2022');
		expect(fixture.nativeElement.textContent).toContain('Dec 20, 2021');
		expect(Viewer).toHaveBeenCalledWith(
			expect.objectContaining({ accessToken: 'test-token', imageId: 'image-1' }),
		);
		expect(mockOn).toHaveBeenCalledWith('image', expect.any(Function));
	});

	it('updates the capture date when Mapillary navigation changes the image', async () => {
		requestService.findNearestImage.mockReturnValue(
			of({
				id: 'image-1',
				coordinates: [13.405, 52.52],
				capturedAt: '2020-07-29T00:00:00.000Z',
				temporalMatch: 'IN_RANGE',
			} satisfies MapillaryImageMatch),
		);

		fixture.componentRef.setInput('latitude', 52.52);
		fixture.componentRef.setInput('longitude', 13.405);
		fixture.componentRef.setInput('year', 2020);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		expect(fixture.nativeElement.textContent).toContain('Jul 29, 2020');
		mockImageHandler?.({
			type: 'image',
			image: {
				id: 'image-2',
				capturedAt: Date.UTC(2014, 11, 15),
			},
		} as ViewerImageEvent);
		fixture.detectChanges();

		expect(fixture.nativeElement.textContent).toContain('Captured Dec 15, 2014');
		expect(fixture.nativeElement.textContent).not.toContain('Jul 29, 2020');
		expect(mockMoveTo).not.toHaveBeenCalled();
	});

	it('restores initial fallback metadata when navigation returns to the initial image', async () => {
		requestService.findNearestImage.mockReturnValue(
			of({
				id: 'image-1',
				coordinates: [13.405, 52.52],
				capturedAt: '2021-12-20T00:00:00.000Z',
				temporalMatch: 'NEAREST_DATE',
			} satisfies MapillaryImageMatch),
		);

		fixture.componentRef.setInput('latitude', 52.52);
		fixture.componentRef.setInput('longitude', 13.405);
		fixture.componentRef.setInput('year', 2022);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		mockImageHandler?.({
			type: 'image',
			image: { id: 'image-2', capturedAt: Date.UTC(2014, 11, 15) },
		} as ViewerImageEvent);
		fixture.detectChanges();
		expect(fixture.nativeElement.textContent).not.toContain('No nearby imagery from 2022');

		mockImageHandler?.({
			type: 'image',
			image: { id: 'image-1', capturedAt: Date.UTC(2021, 11, 20) },
		} as ViewerImageEvent);
		fixture.detectChanges();

		expect(fixture.nativeElement.textContent).toContain('No nearby imagery from 2022');
		expect(fixture.nativeElement.textContent).toContain('Dec 20, 2021');
	});

	it('uses a white shell class that does not collide with Mapillary global styles', () => {
		const shell = fixture.nativeElement.querySelector('section');

		expect(shell.classList).toContain('mapillary-viewer-shell');
		expect(shell.classList).not.toContain('mapillary-viewer');
	});

	it('shows an empty state when no nearby imagery exists', async () => {
		requestService.findNearestImage.mockReturnValue(of(undefined));

		fixture.componentRef.setInput('latitude', 52.52);
		fixture.componentRef.setInput('longitude', 13.405);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		expect(fixture.nativeElement.textContent).toContain(
			'No Mapillary imagery is available within 50 metres',
		);
		expect(Viewer).not.toHaveBeenCalled();
	});

	it('shows a non-sensitive error state when the image lookup fails', async () => {
		requestService.findNearestImage.mockReturnValue(
			throwError(() => new Error('token must not be exposed')),
		);

		fixture.componentRef.setInput('latitude', 52.52);
		fixture.componentRef.setInput('longitude', 13.405);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();

		expect(fixture.nativeElement.textContent).toContain(
			'Mapillary imagery could not be loaded',
		);
		expect(fixture.nativeElement.textContent).not.toContain('token must not be exposed');
	});

	it('removes the Mapillary viewer when the component is destroyed', async () => {
		requestService.findNearestImage.mockReturnValue(
			of({
				id: 'image-1',
				coordinates: [13.405, 52.52],
				capturedAt: '2024-01-01T00:00:00.000Z',
				temporalMatch: 'IN_RANGE',
			} satisfies MapillaryImageMatch),
		);

		fixture.componentRef.setInput('latitude', 52.52);
		fixture.componentRef.setInput('longitude', 13.405);
		fixture.detectChanges();
		await fixture.whenStable();
		fixture.detectChanges();
		fixture.destroy();

		expect(mockOff).toHaveBeenCalledWith('image', expect.any(Function));
		expect(mockRemove).toHaveBeenCalled();
	});
});
