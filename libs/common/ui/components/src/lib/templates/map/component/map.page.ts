import { CommonModule } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	ElementRef,
	EventEmitter,
	inject,
	input, OnDestroy, OnInit,
	Output,
	Signal,
	ViewChild,
	ViewEncapsulation,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { Deck } from '@deck.gl/core';
import { GeocodingControl } from '@maptiler/geocoding-control/maplibregl';
import { APP_CONFIG, IMapPosition } from '@simra/common-models';
import * as maplibregl from 'maplibre-gl';
import { PopoverModule } from 'primeng/popover';
import { BERLIN_POSITION } from '../../models/const';
import { EPin } from '../models/enum/pin.enum';

/**
 * This component allows to interact with the leaflet map smoothly
 */
@Component({
	selector: 't-map-component',
	imports: [CommonModule, PopoverModule],
	templateUrl: './map.page.html',
	styleUrl: './map.page.scss',
	host: {
		class: 't-map-component',
	},
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MapPage implements OnDestroy, OnInit {
	@ViewChild('mapContainer', { static: true })
	mapContainer: ElementRef<HTMLDivElement>;
	private readonly _mapTilerToken = inject(APP_CONFIG).mapTilerToken;
	private mlMap?: maplibregl.Map;
	private deck?: Deck;

	private readonly _activatedRoute = inject(ActivatedRoute);

	public readonly lastRun = input<Date>();
	public readonly isNavigable = input<boolean>(false);

	@Output()
	mapReady = new EventEmitter<maplibregl.Map>();

	private readonly queryParams = toSignal(this._activatedRoute.queryParams);
	public readonly routerPosition: Signal<IMapPosition> = computed(() => {
		const params = this.queryParams();

		const lat = params['lat'] ?? BERLIN_POSITION.lat;
		const lng = params['lng'] ?? BERLIN_POSITION.lng;
		const zoom = params['zoom'] ?? BERLIN_POSITION.zoom;

		// Every Query paramter is a string. To get a boolean, the string has to be parsed
		const isNavigated = params['isNavigated'] === undefined ? false : params['isNavigated'] === 'true';
		const moveTo = params['moveTo'] === undefined ? true : params['moveTo'] === 'true';
		return { lat, lng, zoom, isNavigated, moveTo };
	});

	constructor() {
		effect(() => {
			const position = this.routerPosition();
			const navigable = this.isNavigable();

			if (!this.mlMap || !position || !position.moveTo) return;

			if (navigable && position.isNavigated) {
				this.mlMap?.flyTo({
					center: [position.lng, position.lat],
					zoom: position.zoom,
					speed: 3,
					curve: 1,
				});
			} else {
				this.mlMap?.jumpTo({
					center: [position.lng, position.lat],
					zoom: position.zoom,
				});
			}
		});
	}

	async ngOnInit() {
		const position = this.routerPosition();
		const navigable = this.isNavigable();

		this.mlMap = new maplibregl.Map({
			container: this.mapContainer.nativeElement,
			style: `https://api.maptiler.com/maps/basic-v2/style.json?key=${this._mapTilerToken}`,
			center: [position.lng, position.lat],
			zoom: position.zoom,
		});
		this.mlMap.getCanvas().style.cursor = 'default';

		const redPin = await this.mlMap.loadImage('/assets/icons/incidents/ui/pin-red.png');
		const bluePin = await this.mlMap.loadImage('/assets/icons/incidents/ui/pin-blue.png');
		this.mlMap.addImage(EPin.RED, redPin.data);
		this.mlMap.addImage(EPin.BLUE, bluePin.data);

		if(navigable) {
			const geocoder = new GeocodingControl({ apiKey: this._mapTilerToken});
			this.mlMap.addControl(geocoder);
		}

		setTimeout(() => {
			this.mlMap?.resize();
		}, 0);

		if (this.mlMap.loaded()){
			this.mapReady.emit(this.mlMap);
		} else {
			this.mlMap.on('load', () => {
				this.mapReady.emit(this.mlMap);
			});
		}
	}

	ngOnDestroy() {
		if (this.deck) this.deck.finalize();
		if (this.mlMap) this.mlMap.remove();
	}
}
