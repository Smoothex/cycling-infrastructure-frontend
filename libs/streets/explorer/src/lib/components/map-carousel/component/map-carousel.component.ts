
import {
	ApplicationRef,
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	inject,
	Injector,
	signal,
	ViewEncapsulation,
} from '@angular/core';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Store } from '@ngxs/store';
import { EPin, MapPage, MapUtils } from '@simra/common-components';
import { IIncident } from '@simra/incidents-models';
import { createIncidentMarker } from '@simra/incidents-ui';
import { IEnrichedStreet } from '@simra/streets-common';
import { StreetDetailState } from '@simra/streets-domain';
import { along, length, lineString } from '@turf/turf';
import { FeatureCollection, Geometry } from 'geojson';
import { times } from 'lodash';
import * as maplibregl from 'maplibre-gl';
import { TabList, TabPanels, TabsModule } from 'primeng/tabs';
import proj4 from 'proj4';
import {
	incidentsLayer, incidentsSource,
	streetsLayer,
	streetsSource,
} from '../models/const';
import { MapillaryComponent } from '../../mapillar/component/mapillary.component';

@Component({
	selector: 'm-map-carousel',
	imports: [
    TabsModule,
    MapillaryComponent,
    TabList,
    TabPanels,
    MapPage,
    TranslatePipe
],
	templateUrl: './map-carousel.component.html',
	styleUrl: './map-carousel.component.scss',
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'm-map-carousel',
	},
})
export class MapCarouselComponent {
	private readonly _store = inject(Store);
	private readonly _router = inject(Router);
	private readonly _injector = inject(Injector);
	private readonly _appRef = inject(ApplicationRef);

	protected readonly _street$ = this._store.selectSignal(StreetDetailState.getStreet);
	protected readonly _safetyMetrics$ = this._store.selectSignal(
		StreetDetailState.getSelectedSafetyMetrics,
	);
	protected readonly _incidents$ = this._store.selectSignal(
		StreetDetailState.getSelectedIncidents,
	);

	protected hasMapillaryImage = signal<boolean>(false);
	private readonly _mlMap = signal<maplibregl.Map>(undefined);

	protected readonly convertedCoordinates = computed(() => {
		const street = this._street$();
		if (!street) {
			return;
		}

		return street.way.coordinates
			.map((coordinate) => proj4('EPSG:3857', 'EPSG:4326', [coordinate[0], coordinate[1]]))
			.map(([lng, lat]) => [lat, lng]);
	});

	protected readonly _enrichedStreet$ = computed<IEnrichedStreet>(() => {
		const street = this._street$();
		const safetyMetrics = this._safetyMetrics$();
		const convertedCoordinates = this.convertedCoordinates();

		if (!street) {
			return;
		}

		const way = {
			type: 'LineString',
			coordinates: convertedCoordinates.map(([lat, lng]) => [lng, lat]),
		};

		return {
			highway: street.highway,
			way: JSON.stringify(way),
			osmId: street.id,
			dangerousColor: safetyMetrics.dangerousColor,
		} as IEnrichedStreet;
	});

	constructor() {
		effect(() => {
			const convertedCoordinates = this.convertedCoordinates();
			if (!convertedCoordinates) {
				return;
			}

			const line = lineString(convertedCoordinates);
			const midpoint = along(line, length(line) / 2);
			const center = midpoint.geometry.coordinates;
			this._router.navigate([], {
				queryParams: { lat: center[0], lng: center[1], zoom: 16, isNavigated: true },
				queryParamsHandling: 'merge',
				replaceUrl: true,
			});
		});

		effect(() => {
			const street = this._enrichedStreet$();
			const incidents = this._incidents$();
			const map = this._mlMap();

			if (!street || !incidents || !map) {
				return;
			}

			this.addStreetLayer(map, street);
			this.addIncidentsLayer(map, incidents);
		});
	}

	addStreetLayer(map: maplibregl.Map, street: IEnrichedStreet) {
		const streetCollection = {
			type: 'FeatureCollection',
			features: [
				{
					type: 'Feature',
					geometry: JSON.parse(`${street.way}`),
					properties: {
						osmId: street.osmId,
						dangerousColor: street.dangerousColor,
					},
				},
			],
		} as FeatureCollection<Geometry, IEnrichedStreet>;

		const source = map.getSource(streetsSource) as maplibregl.GeoJSONSource;
		if (source) {
			source.setData(streetCollection);
			return;
		}

		map.addSource(streetsSource, {
			type: 'geojson',
			data: streetCollection,
		});

		map.addLayer({
			id: streetsLayer,
			type: 'line',
			source: streetsSource,
			paint: {
				'line-color': ['get', 'dangerousColor'],
				'line-width': ['interpolate', ['linear'], ['zoom'], 10, 1, 14, 3],
			},
			minzoom: 11,
		});

		MapUtils.changeCursor(map, streetsLayer);
	}

	addIncidentsLayer(map: maplibregl.Map, incidents: IIncident[]) {
		const markerCollection = {
			type: 'FeatureCollection',
			features: incidents.map((m) => ({
				type: 'Feature',
				geometry: {
					type: 'Point',
					coordinates: [m.lng, m.lat],
				},
				properties: m,
			})),
		} as FeatureCollection<Geometry, IIncident>;

		const source = map.getSource(incidentsSource) as maplibregl.GeoJSONSource;
		if (source) {
			source.setData(markerCollection);
			return;
		}

		map.addSource(incidentsSource, {
			type: 'geojson',
			data: markerCollection,
		});

		map.addLayer({
			id: incidentsLayer,
			type: 'symbol',
			source: incidentsSource,
			layout: {
				'icon-allow-overlap': true,
				'icon-ignore-placement': true,
				'icon-image': [
					'case',
					['==', ['get', 'scary'], true],
					EPin.RED,
					EPin.BLUE,
				],
				'icon-size': [
					'interpolate',
					['linear'],
					['zoom'],
					10, 0.15,
					14, 0.2,
					17, 0.3
				]
			},
			minzoom: 11,
			paint: {
				'icon-opacity': 1
			}
		});

		MapUtils.changeCursor(map, incidentsLayer);

		map.on('click', incidentsLayer, async (evt) => {
			const f = evt.features?.[0];
			if (f?.properties) {
				await createIncidentMarker(
					{
						...f.properties,
						participantsInvolved: JSON.parse(f.properties['participantsInvolved']),
					} as IIncident,
					this._injector,
					this._appRef,
					undefined,
					map,
				);
			}
		});
	}

	onMapLoaded(mlMap: maplibregl.Map) {
		this._mlMap.set(mlMap);
	}

	protected readonly times = times;
}
