import {
	ChangeDetectionStrategy,
	Component, computed,
	effect,
	ElementRef,
	inject, output,
	resource,
	ViewChild,
	ViewEncapsulation,
} from '@angular/core';

import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { APP_CONFIG } from '@simra/common-models';
import { StreetDetailViewFacade } from '@simra/streets-domain';
import { Viewer, ViewerOptions } from 'mapillary-js';
import { firstValueFrom } from 'rxjs';

@Component({
	selector: 'a-mapillary',
	imports: [],
	templateUrl: './mapillary.component.html',
	styleUrl: './mapillary.component.scss',
	host: {
		class: 'a-mapillary',
	},
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapillaryComponent {
	private readonly _activeRoute = inject(ActivatedRoute);
	private readonly _streetDetailViewFacade = inject(StreetDetailViewFacade);

	@ViewChild('mapillaryContainer')
	private readonly mapillaryContainer: ElementRef;

	hasMapillaryImage = output<boolean>();

	private readonly _accessToken = inject(APP_CONFIG).mapillaryAccessToken;

	private readonly _routeParamsRaw = toSignal(this._activeRoute.queryParams, { manualCleanup: true });

	/**
	 * Angular does create new instances of the component when the route params change.
	 * Therefor we need to create an internal signal to patch the change object reference correctly.
	 *
	 * @private
	 */
	private readonly _coords = computed(() => {
		const { lat, lng } = this._routeParamsRaw();
		if (!lat || !lng) {
			return;
		}

		return { lat, lng };
	});

	private readonly _mapillaryImageId$ = resource({
		params: () => this._coords(),
		loader: async ({ params }) => {
			const { lat, lng } = params;
			if (!lat || !lng) {
				return;
			}
			return await firstValueFrom(this._streetDetailViewFacade.getIdOfNearestImage(lat, lng));
		},
	});

	constructor() {
		effect(() => {
			const imageId = this._mapillaryImageId$.value();
			if (!imageId) {
				return;
			}

			this.hasMapillaryImage.emit(true);

			this._waitForLayoutAndInit(imageId);
		});
	}

	/**
	 * This function waits for the layout to be ready and then initializes the Mapillary viewer otherwise race conditions can occur.
	 */
	private _waitForLayoutAndInit(imageId: number)  {
		const container = this.mapillaryContainer.nativeElement;

		const width = container.clientWidth;
		const height = container.clientHeight;

		if (width > 0 && height > 0) {
			new Viewer({
				accessToken: this._accessToken,
				container,
				imageId: `${imageId}`,
			} as ViewerOptions);
		} else {
			requestAnimationFrame(this._waitForLayoutAndInit.bind(this, imageId));
		}
	};
}
