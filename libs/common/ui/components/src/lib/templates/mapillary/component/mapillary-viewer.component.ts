import { DatePipe } from '@angular/common';
import {
	AfterViewInit,
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	inject,
	input,
	OnDestroy,
	output,
	resource,
	signal,
	ViewChild,
} from '@angular/core';
import { APP_CONFIG } from '@simra/common-models';
import { Viewer, type ViewerImageEvent } from 'mapillary-js';
import { firstValueFrom } from 'rxjs';
import {
	MapillaryImageMatch,
	MapillaryRequestService,
} from '../services/mapillary-request.service';

export type MapillaryViewerStatus = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

interface MapillarySearchParams {
	latitude: number;
	longitude: number;
	year?: number;
}

interface DisplayedMapillaryImage {
	id: string;
	capturedAt: string;
	temporalMatch?: MapillaryImageMatch['temporalMatch'];
}

@Component({
	selector: 't-mapillary-viewer',
	imports: [DatePipe],
	templateUrl: './mapillary-viewer.component.html',
	styleUrl: './mapillary-viewer.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapillaryViewerComponent implements AfterViewInit, OnDestroy {
	@ViewChild('mapillaryContainer', { static: true })
	private readonly _mapillaryContainer?: ElementRef<HTMLDivElement>;

	readonly latitude = input<number | undefined>();
	readonly longitude = input<number | undefined>();
	readonly year = input<number | undefined>();
	readonly statusChange = output<MapillaryViewerStatus>();

	private readonly _mapillaryRequestService = inject(MapillaryRequestService);
	private readonly _accessToken = inject(APP_CONFIG).mapillaryAccessToken;
	private readonly _searchParams = computed<MapillarySearchParams | undefined>(() => {
		const latitude = this.latitude();
		const longitude = this.longitude();
		if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
			return undefined;
		}

		return {
			latitude: latitude as number,
			longitude: longitude as number,
			year: this.year(),
		};
	});
	private readonly _imageResource = resource<
		MapillaryImageMatch | undefined,
		MapillarySearchParams | undefined
	>({
		params: () => this._searchParams(),
		loader: async ({ params }) => {
			const year = params.year;
			return firstValueFrom(
				this._mapillaryRequestService.findNearestImage(
					params.latitude,
					params.longitude,
					year === undefined
						? {}
						: {
								from: new Date(Date.UTC(year, 0, 1)),
								to: new Date(Date.UTC(year + 1, 0, 1) - 1),
								fallbackToNearestDate: true,
							},
				),
			);
		},
	});

	protected readonly status = signal<MapillaryViewerStatus>('idle');
	protected readonly displayedImage = signal<DisplayedMapillaryImage | undefined>(undefined);

	private _viewer?: Viewer;
	private _initialImage?: MapillaryImageMatch;
	private _viewerImageId?: string;
	private _resizeObserver?: ResizeObserver;
	private _viewInitialized = false;
	private _destroyed = false;
	private readonly _handleViewerImage = (event: ViewerImageEvent): void => {
		if (this._destroyed) {
			return;
		}

		this._viewerImageId = event.image.id;
		const initialImage = this._initialImage;
		if (initialImage?.id === event.image.id) {
			this.displayedImage.set(this.toDisplayedImage(initialImage));
			return;
		}

		this.displayedImage.set({
			id: event.image.id,
			capturedAt: new Date(event.image.capturedAt).toISOString(),
		});
	};

	constructor() {
		effect(() => {
			const params = this._searchParams();
			if (!params) {
				this._initialImage = undefined;
				this.displayedImage.set(undefined);
				this.setStatus('idle');
				this.clearViewer();
				return;
			}

			if (this._imageResource.isLoading()) {
				this.setStatus('loading');
				return;
			}

			if (this._imageResource.error()) {
				this._initialImage = undefined;
				this.displayedImage.set(undefined);
				this.setStatus('error');
				this.clearViewer();
				return;
			}

			const image = this._imageResource.value();
			this._initialImage = image;
			this.displayedImage.set(image === undefined ? undefined : this.toDisplayedImage(image));
			if (!image) {
				this.setStatus('empty');
				this.clearViewer();
				return;
			}

			this.setStatus('ready');
			this.initializeOrMoveViewer(image.id);
		});
	}

	ngAfterViewInit(): void {
		this._viewInitialized = true;
		const image = this._initialImage;
		if (image) {
			this.initializeOrMoveViewer(image.id);
		}
	}

	ngOnDestroy(): void {
		this._destroyed = true;
		this.clearViewer();
	}

	private initializeOrMoveViewer(imageId: string): void {
		if (!this._viewInitialized || this._destroyed) {
			return;
		}

		if (this._viewer) {
			if (this._viewerImageId === imageId) {
				return;
			}
			this._viewerImageId = imageId;
			void this._viewer.moveTo(imageId).catch(() => this.handleViewerError(imageId));
			return;
		}

		const container = this._mapillaryContainer?.nativeElement;
		if (!container) {
			return;
		}

		if (container.clientWidth === 0 || container.clientHeight === 0) {
			this._resizeObserver ??= new ResizeObserver(() => this.initializeOrMoveViewer(imageId));
			this._resizeObserver.observe(container);
			return;
		}

		this._resizeObserver?.disconnect();
		this._resizeObserver = undefined;
		try {
			this._viewer = new Viewer({
				accessToken: this._accessToken,
				container,
				imageId,
			});
			this._viewer.on('image', this._handleViewerImage);
			this._viewerImageId = imageId;
		} catch {
			this.handleViewerError(imageId);
		}
	}

	private toDisplayedImage(image: MapillaryImageMatch): DisplayedMapillaryImage {
		return {
			id: image.id,
			capturedAt: image.capturedAt,
			temporalMatch: image.temporalMatch,
		};
	}

	private handleViewerError(imageId: string): void {
		if (this._destroyed || this._viewerImageId !== imageId) {
			return;
		}
		this._initialImage = undefined;
		this.displayedImage.set(undefined);
		this.setStatus('error');
		this.clearViewer();
	}

	private setStatus(status: MapillaryViewerStatus): void {
		if (this.status() === status) {
			return;
		}
		this.status.set(status);
		this.statusChange.emit(status);
	}

	private clearViewer(): void {
		this._resizeObserver?.disconnect();
		this._resizeObserver = undefined;
		if (this._viewer) {
			this._viewer.off('image', this._handleViewerImage);
			this._viewer.remove();
		}
		this._viewer = undefined;
		this._viewerImageId = undefined;
	}
}
