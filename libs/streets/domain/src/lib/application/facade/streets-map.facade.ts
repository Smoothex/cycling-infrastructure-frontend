import { effect, inject, Injectable } from '@angular/core';
import { Store } from '@ngxs/store';
import { MethodRunService } from '@simra/common-domain';
import { ISafetyMetricsRegion, MapFilterOptionsInterface } from '@simra/common-models';
import { IIncident } from '@simra/incidents-models';
import { IEnrichedRegion, IEnrichedStreet, IStreetGrid, SafetyMetricsDto } from '@simra/streets-common';
import { FeatureCollection, Geometry } from 'geojson';
import { Observable, Subject, take, tap } from 'rxjs';
import { IRegionMap } from '@simra/streets-common';
import { IncidentsRequestService } from '../../infrastructure/incidents-request.service';
import { RegionRequestService } from '../../infrastructure/region-request.service';
import { SafetyMetricsRequestService } from '../../infrastructure/safety-metrics-request.service';
import { StreetsRequestService } from '../../infrastructure/streets-request.service';
import { StreetInformationDto } from '../../models/dtos/street-information.dto';
import { SetEnrichedRegions, SetRegionCollection, SetRegions, SetRegionSafetyMetrics } from '../store/region-map.actions';
import { RegionMapState } from '../store/region-map.state';
import { SetSelectedSafetyMetrics } from '../store/street-detail.actions';
import { SetEnrichedStreets, SetStreets, SetStreetSafetyMetrics } from '../store/street-map.actions';
import { StreetMapState } from '../store/street-map.state';

@Injectable({ providedIn: 'root' })
export class StreetsMapFacade {
	private readonly _streetsRequestService = inject(StreetsRequestService);
	private readonly _incidentRequestService = inject(IncidentsRequestService);
	private readonly _safetyMetricsRequestService = inject(SafetyMetricsRequestService);
	private readonly _regionRequestService = inject(RegionRequestService);
	private readonly _methodRunService = inject(MethodRunService);
	private readonly _store = inject(Store);

	private readonly _loadedStreets = this._store.selectSignal(StreetMapState.getStreets);
	private readonly _streetsSafetyMetrics = this._store.selectSignal(StreetMapState.getSafetyMetrics);
	private readonly _loadedRegions = this._store.selectSignal(RegionMapState.getRegionMap);
	private readonly _regionsSafetyMetrics = this._store.selectSignal(RegionMapState.getSafetyMetrics);


	private _fetchStreetSubject = new Subject<MapFilterOptionsInterface>();

	constructor() {
		effect(() => {
			const loadedStreets = this._loadedStreets();
			const streetsSafetyMetrics = this._streetsSafetyMetrics();

			if (!loadedStreets || !streetsSafetyMetrics) {
				return;
			}

			const enrichedStreets = loadedStreets.map((street: IStreetGrid) => {
				const color = streetsSafetyMetrics[street.osmId];
				if (!color) {
					return undefined;
				}

				return {
					...street,
					dangerousColor: color,
				} as IEnrichedStreet;
			}).filter(street => street !== undefined);

			this._store.dispatch(new SetEnrichedStreets(enrichedStreets));
		});

		effect(() => {
			const loadedRegions = this._loadedRegions();
			const regionsSafetyMetrics = this._regionsSafetyMetrics();

			if (!loadedRegions || !regionsSafetyMetrics) {
				return;
			}

			const enrichedRegions = loadedRegions.map((region: IRegionMap) => {
				const color = regionsSafetyMetrics[region.name];
				if (!color) {
					return undefined;
				}

				return {
					...region,
					dangerousColor: color,
				} as IEnrichedRegion;
			}).filter(region => region !== undefined);

			this._store.dispatch(new SetEnrichedRegions(enrichedRegions));

			const collection = {
				type: 'FeatureCollection',
				features: enrichedRegions.map((region) => ({
					type: 'Feature',
					geometry: JSON.parse(`${region.way}`),
					properties: {
						name: region.name,
						dangerousColor: region.dangerousColor,
						adminLevel: region.adminLevel,
					},
				})),
			}  as FeatureCollection<Geometry, IEnrichedRegion>;
			this._store.dispatch(new SetRegionCollection(collection));
		});
	}

	public fetchStreetInformation(requestParams: MapFilterOptionsInterface): void {
		this._fetchStreetSubject.next(requestParams);
	}

	// TODO: handle click events
	private toGeoJSON(street: StreetInformationDto): FeatureCollection<Geometry> {
		return JSON.parse(`${street.way}`);
	}

	public fetchStreetGrid(): void {
		const grid = this._loadedStreets();
		if(grid) {
			return;
		}

		this._streetsRequestService.getStreetGrid().pipe(
			tap(res => this._store.dispatch(new SetStreets(res))),
		).subscribe();
	}

	public fetchRegionMap(): void {
		const regionMap = this._loadedRegions();
		if(regionMap) {
			return;
		}

		this._regionRequestService.getRegionMap().pipe(
			tap(res => this._store.dispatch(new SetRegions(res))),
		).subscribe();
	}

	public updateMap(filterOptions: MapFilterOptionsInterface) {
		return this._safetyMetricsRequestService.getColorOfStreet(filterOptions).pipe(
			tap((safetyMetrics) => {
				this._store.dispatch(new SetStreetSafetyMetrics(safetyMetrics));
			})
		);
	}

	public updateRegionMap(filterOptions: MapFilterOptionsInterface) {
		return this._safetyMetricsRequestService.getColorOfMap(filterOptions).pipe(
			tap((safetyMetrics) => {
				this._store.dispatch(new SetRegionSafetyMetrics(safetyMetrics));
			})
		);
	}

	public fetchSafetyMetricsForStreet(streetId: number, filter: MapFilterOptionsInterface): Observable<SafetyMetricsDto> {
		return this._safetyMetricsRequestService.getSafetyMetricsForStreet(streetId, filter).pipe(
			take(1),
			tap((response: SafetyMetricsDto) => {
				this._store.dispatch(new SetSelectedSafetyMetrics(response));
			})
		);
	}

	public fetchIncidentsForStreet(streetId: number, filter: MapFilterOptionsInterface): Observable<IIncident[]> {
		return this._incidentRequestService.getIncidentForStreet(streetId, filter)
	}

	public fetchLastMethodRun(methodName: string) {
		return this._methodRunService.getDateOfLastMethodRun(methodName);
	}

	public fetchSafetyMetricsForRegion(regionName: string, filter: MapFilterOptionsInterface): Observable<ISafetyMetricsRegion> {
		return this._regionRequestService.getRegionSafetyMetrics(regionName, filter);
	}
}
