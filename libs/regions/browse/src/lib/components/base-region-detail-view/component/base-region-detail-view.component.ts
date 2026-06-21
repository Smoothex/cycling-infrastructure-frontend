import { CommonModule } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component, computed,
	effect,
	inject, input,
	model, output, signal, Signal,
	ViewEncapsulation,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { LastRunComponent, MapPage, MapUtils, SafetyMetricsCardComponent } from '@simra/common-components';
import { ETrafficTimes, EWeekDays, EYear, IMapPosition, ISafetyMetricsRegion } from '@simra/common-models';
import { IRegion } from '@simra/models';
import { IEnrichedRegion } from '@simra/streets-common';
import { area, centroid, polygon as turfPolygon } from '@turf/turf';
import { FeatureCollection, Geometry } from 'geojson';
import { find, first } from 'lodash';
import * as maplibregl from 'maplibre-gl';
import { MarkdownComponent } from 'ngx-markdown';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { Card } from 'primeng/card';
import { UIChart } from 'primeng/chart';
import { Divider } from 'primeng/divider';
import { Skeleton } from 'primeng/skeleton';
import { Tooltip } from 'primeng/tooltip';
import { SafetyMetricsService } from '../../../services/safety-metrics.service';
import { scoreFormulaMarkdownRegion } from '../../utils/markdown';
import { regionLayer, regionSource } from '../models/const';
import { getZoomLevelByArea } from '../models/functions/zoom.util';
import { IDetailViewChange } from '../models/interfaces/detail-view-change.interface';

// TODO: replace this. This is only temporary to remove leaflet
interface SimpleMapOptions {
    zoom: number;
    center: { lat: number; lng: number };
}

@Component({
	selector: 't-base-region-detail-view',
	imports: [
		CommonModule,
		AutoCompleteModule,
		FormsModule,
		SafetyMetricsCardComponent,
		TranslatePipe,
		UIChart,
		Card,
		Divider,
		MapPage,
		Skeleton,
		LastRunComponent,
		Tooltip,
		MarkdownComponent,
	],
	templateUrl: './base-region-detail-view.component.html',
	styleUrl: './base-region-detail-view.component.scss',
	host: {
		class: 't-base-region-detail-view',
	},
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BaseRegionDetailViewComponent {
	private readonly _metricsService = inject(SafetyMetricsService);
	protected readonly _router = inject(Router);

	protected readonly _selectedYear = model<EYear>(EYear.ALL);
	protected readonly _selectedWeekDays = model<EWeekDays[]>([EWeekDays.WEEK, EWeekDays.WEEKEND]);
	protected readonly _selectedTrafficTime = model<ETrafficTimes>(ETrafficTimes.ALL_DAY);
	public readonly queryOptions = model<IMapPosition>();
	private readonly _mlMap= signal<maplibregl.Map>(undefined);

	public readonly lastRun = input.required<Date>();
	public readonly changeDetails = output<IDetailViewChange>();

	public readonly safetyMetrics = input.required<ISafetyMetricsRegion>();
	protected readonly _generalSafetyMetrics: Signal<ISafetyMetricsRegion | undefined> = computed(
		() => {
			const safetyMetrics = this._metricsService.safetyMetrics$();
			if (!safetyMetrics) {
				return;
			}

			return find(safetyMetrics, (metrics) => {
				return (
					metrics.weekDay === EWeekDays.ALL_WEEK &&
					metrics.trafficTime === ETrafficTimes.ALL_DAY &&
					metrics.year === EYear.ALL
				);
			});
		},
	);
	public readonly detailedRegion = input.required<IRegion>();
	protected readonly _mapOptions$ = computed<SimpleMapOptions | undefined>(() => {
		const region = this.detailedRegion();
		if (!region) {
			return;
		}

		const tPoly = turfPolygon(region.way.coordinates);
		const zoom = getZoomLevelByArea(area(tPoly));
		const {
			geometry: {
				coordinates: [lng, lat],
			},
		} = centroid(tPoly);

		return { zoom , center: { lat, lng } };
	});

	constructor() {
		effect(async () => {
			const year = this._selectedYear();
			const weekDays = this._selectedWeekDays();
			const trafficTime = this._selectedTrafficTime();
			if (!year || !weekDays || !trafficTime) {
				this._selectedYear.set(EYear.ALL);
				this._selectedWeekDays.set([EWeekDays.WEEK, EWeekDays.WEEKEND]);
				this._selectedTrafficTime.set(ETrafficTimes.ALL_DAY);
			}
		});

		effect(() => {
			const safetyMetrics = this.safetyMetrics();
			if (!safetyMetrics) {
				return;
			}

			this._metricsService._singleSafetyMetrics$.set(safetyMetrics);
		});

		effect(() => {
			const year = this._selectedYear() || EYear.ALL;
			const trafficTime = this._selectedTrafficTime();
			const weekDays = this._selectedWeekDays();
			const weekDay = weekDays?.length === 1 ? first(weekDays) : EWeekDays.ALL_WEEK;

			this.changeDetails.emit({ year, trafficTime, weekDay });
		});

		effect(() => {
			const mapOptions = this._mapOptions$();
			if (!mapOptions) {
				return;
			}

			const center = mapOptions.center;
			this.queryOptions.set({ zoom: mapOptions.zoom + 5, lat: center.lat, lng: center.lng });
			this._router.navigate([], {
				queryParams: { lat: center.lat, lng: center.lng, zoom: mapOptions.zoom },
				queryParamsHandling: 'merge',
				replaceUrl: true,
			});
		});

		effect(() => {
			const map = this._mlMap();
			const region = this.detailedRegion();

			if (!map || !region) {
				return;
			}

			const latLngPolygon = region.way.coordinates.map((ring) =>
				ring.map(([lng, lat]) => [lng, lat]),
			);
			const collection = {
				type: 'FeatureCollection',
				features: [{
					type: 'Feature',
					geometry: {
						type: 'Polygon',
						coordinates: latLngPolygon,
					},
					properties: {
						name: region.name,
						dangerousColor: '#FBBF24',
						adminLevel: region?.adminLevel,
					},
				}],
			} as FeatureCollection<Geometry, IEnrichedRegion>;

			map.addSource(regionSource, {
				type: 'geojson',
				data: collection,
			});

			map.addLayer({
				id: regionLayer,
				type: 'fill',
				source: regionSource,
				paint: {
					'fill-color': ['get', 'dangerousColor'],
					'fill-opacity': 0.5,
				},
			});

			MapUtils.changeCursor(map, regionLayer);
		});
	}

	onMapReady(map: maplibregl.Map) {
		this._mlMap.set(map);
	}

	protected readonly _pieMetricsIncidentTypesData =
		this._metricsService.pieMetricsIncidentTypesData$;
	protected readonly _barMetricsRideIncidentDistributionData =
		this._metricsService.barMetricsRideIncidentDistributionData$;
	protected readonly _stackedChartYearMetrics = this._metricsService.stackedBarChartYearMetrics$;
	protected readonly _lineChartYearMetrics = this._metricsService.lineChartYearMetrics$;

	protected readonly _stackedBarChartWeekDaysMetrics$ =
		this._metricsService.stackedBarChartWeekDaysMetrics$;
	protected readonly _lineChartWeekDaysMetrics$ = this._metricsService.lineChartWeekDaysMetrics$;
	protected readonly _lineChartTrafficTimesMetrics$ =
		this._metricsService.lineChartTrafficTimesMetrics$;
	protected readonly _stackedBarChartTrafficTimesMetrics$ =
		this._metricsService.stackedBarChartTrafficTimesMetrics$;
	protected stackedBarChartOptions = this._metricsService.stackBarChartOptions();
	protected lineChartOptions = this._metricsService.lineChartOptions();
	protected readonly _headerPrefix = 'STREETS.EXPLORER.GENERAL.TABLE.HEADER.COLUMNS';

	protected readonly _scoreMarkdown = computed(() => {
		const safetyMetrics = this._generalSafetyMetrics();
		if (!safetyMetrics) {
			return;
		}

		const { numberOfIncidents, numberOfScaryIncidents, totalDistance, dangerousScore } = safetyMetrics;
		return scoreFormulaMarkdownRegion(numberOfIncidents, numberOfScaryIncidents, totalDistance, dangerousScore);
	});
}
