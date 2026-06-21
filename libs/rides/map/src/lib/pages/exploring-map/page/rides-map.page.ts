
import {
	ChangeDetectionStrategy,
	Component,
	effect,
	inject,
	model, signal,
	ViewEncapsulation,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { EPin, MapPage, MapUtils } from '@simra/common-components';
import { asyncComputed } from '@simra/common-utils';
import { RidesGeometriesInterface } from '@simra/rides-common-models';
import { RidesFacade } from '@simra/rides-domain';
import { along, length, lineString } from '@turf/turf';
import { FeatureCollection, Geometry } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import { Card } from 'primeng/card';
import { InputNumber } from 'primeng/inputnumber';
import { linesLayer, rideSource, markerLayer,  } from '../models/const';


@Component({
    selector: 'p-ride-exploring-map',
    imports: [MapPage, FormsModule, InputNumber, Card],
    templateUrl: './rides-map.page.html',
    styleUrl: './rides-map.page.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    encapsulation: ViewEncapsulation.None,
    host: {
        class: 'p-rides-map',
    }
})
export class RidesMapPage {
	private readonly _router = inject(Router);
	private readonly _ridesExploringFacade = inject(RidesFacade);

	private readonly _mlMap = signal<maplibregl.Map>(undefined);
	protected _counter = model<number>(1);
	protected readonly _ridesGeometries$ = asyncComputed(() => {
		let counter = this._counter();

		if (counter === undefined) {
			counter = 1;
			this._counter.set(1);
		}

		return this._ridesExploringFacade.getRideGeometries(counter);
	});

	constructor() {
		effect(() => {
			const rides = this._ridesGeometries$();

			if (!rides) {
				return;
			}

			const lineStringJSON = JSON.parse(rides.visitedWay);
			const line = lineString(lineStringJSON.coordinates);
			const midpoint = along(line, length(line) / 2);
			const center = midpoint.geometry.coordinates;
			this._router.navigate([], {
				queryParams: { lat: center[1], lng: center[0], zoom: 12, isNavigated: true },
				queryParamsHandling: 'merge',
				replaceUrl: true,
			})
		});

		effect(() => {
			const mlMap = this._mlMap();
			const geometries = this._ridesGeometries$();

			if (!mlMap || !geometries) {
				return;
			}

			this.addLayer(mlMap, geometries);
		});
	}

	private addLayer(mlMap: maplibregl.Map, geometries: RidesGeometriesInterface) {

		const ways = [{
			way: geometries.visitedWay,
			dangerousColor: '#FBBF24',
			width: 2
		}];
		for (const way of geometries.assignedWays) {
			ways.push({
				way: way,
				width: 3,
				dangerousColor: '#F97316',
			});
		}
		for (const way of geometries.incidentWays) {
			ways.push({
				way: way,
				width: 5,
				dangerousColor: '#EF4444',
			});
		}
		const lineFeature = ways.map((l) => ({
			type: 'Feature',
			geometry: JSON.parse(`${l.way}`),
			properties: {
				dangerousColor: l.dangerousColor,
				type: 'line',
				width: l.width,
			},
		}));

		const incidentFeature = geometries.incidentLocations.map((m) => ({
			type: 'Feature',
			geometry: {
				type: 'Point',
				coordinates: [m.lng, m.lat],
			},
			properties: {
				id: m.id,
				scary: m.scary,
				type: 'marker',
			},
		}))

		const collection = {
			type: 'FeatureCollection',
			features: [...lineFeature, ...incidentFeature]
		} as FeatureCollection<Geometry, unknown>;

		const source = mlMap.getSource(rideSource) as maplibregl.GeoJSONSource;
		if (source) {
			source.setData(collection);
			return;
		}

		mlMap.addSource(rideSource, {
			type: 'geojson',
			data: collection,
		});

		mlMap.addLayer({
			id: linesLayer,
			type: 'line',
			source: rideSource,
			paint: {
				'line-color': ['get', 'dangerousColor'],
				'line-width': ['get', 'width'],
			},
			filter: ['==', '$type', 'LineString']
		});

		mlMap.addLayer({
			id: markerLayer,
			type: 'symbol',
			source: rideSource,
			filter: ['==', '$type', 'Point'],
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
					10, 0.1,
					14, 0.15,
					17, 0.3
				]
			},
			paint: {
				'icon-opacity': 1
			}
		});

		MapUtils.changeCursor(mlMap, linesLayer);
		MapUtils.changeCursor(mlMap, markerLayer);
	}

	onMapReady(mlMap: maplibregl.Map) {
		this._mlMap.set(mlMap);
	}

}
