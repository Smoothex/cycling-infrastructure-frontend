import { Component, effect, input, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { FormsModule } from '@angular/forms';
import { Card } from 'primeng/card';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { Divider } from 'primeng/divider';
import { FeatureCollection, GeoJsonProperties,  Polygon } from 'geojson';
import { IntersectionsRequestService } from '@simra/intersections-domain';
import {
	Base,
	DateFilterPrecomputed,
	DATE_FILTER_DEFAULTS,
	RegionMetric,
	RegionMetricData,
	RegionMetricRow,
	RegionMetricRequest,
	mapRegionMetricToRows,
	IntersectionMap,
	IntersectionChart,
	IntersectionChartMetric,
	IntersectionChartMatricArray,
	RideRegionMetric,
	ChartConfig,
	BASE_CHART_CONFIG,
	EdgePageableRequest,
	NodePageableRequest,
	getZoomRegion,
	BASE_METRIC_CHART_CONFIG,
	EdgePageableMetricRequest,
	NodePageableMetricRequest
} from '@simra/intersections-common';
import { EYear, ETrafficTimes, EWeekDays,  } from '@simra/common-models';


@Component({
	selector: 'region-detail',
	imports: [CommonModule, FormsModule, ButtonModule, Card, ChartModule, TableModule, Divider, TranslatePipe, RouterLink,
		IntersectionMap, IntersectionChart, IntersectionChartMetric, IntersectionChartMatricArray, DateFilterPrecomputed],
	templateUrl: './region-detail.html'
})
export class IntersectionsRegionDetail {
	private readonly _requestService = inject(IntersectionsRequestService);

	protected readonly regionRequest = signal<RegionMetricRequest | null>(null);
	protected _selectedYear = signal<EYear>(DATE_FILTER_DEFAULTS.year);
    protected _selectedWeekDays = signal<EWeekDays>(DATE_FILTER_DEFAULTS.weekDays);
    protected _selectedTrafficTime = signal<ETrafficTimes>(DATE_FILTER_DEFAULTS.trafficTime);

	protected readonly trafficSignalClusterId = NaN;
	protected readonly regionId = input<string>();
	protected readonly region = signal<RegionMetric | undefined>(undefined);
	protected readonly regionFeature = signal<FeatureCollection<Polygon, GeoJsonProperties> | undefined>(undefined);
	protected readonly regionZoom = computed(() => {
		const regionFeature = this.regionFeature();
		if (!regionFeature) return;
		return getZoomRegion(regionFeature);
	});
	protected readonly mapLoading = signal<boolean>(true);

	protected readonly nodeProperties = signal<Base[]>([]);
	protected readonly nodeLoading = signal<boolean>(true);
	protected readonly edgeProperties = signal<Base[]>([]);
	protected readonly edgeLoading = signal<boolean>(true);
	protected readonly rideProperties = signal<RideRegionMetric[]>([]);
	protected readonly rideLoading = signal<boolean>(true);


	constructor() {
		effect(async () => {
			const regionId = this.regionId();
			if (!regionId) return;

			this.regionRequest.set({
				regionId: Number(regionId),
				numberOfRides: 0,
				weekDay: this._selectedWeekDays(),
				trafficTime: this._selectedTrafficTime(),
				year: this._selectedYear()
			});
		});

		effect(async () => {
			const request = this.regionRequest();
			if (!request) return;
			this.mapLoading.set(true);
			const data = await this._requestService.getIntersectionRegionMetricsPageable(request);
			this.regionFeature.set(data.geoData);
			const regions: RegionMetricRow[] = mapRegionMetricToRows(data.geoData);
			if (regions.length === 1) {
				this.region.set(regions[0]);
			}
			this.mapLoading.set(false);
		});

		effect(async () => {
			const request = this.regionRequest();
			if (!request) return;
			this.nodeLoading.set(true);
			const data = await this._requestService.getIntersectionNodeProperties({
				...request,
				page: 0,
				size: 1000
			});
			this.nodeProperties.set(data.properties);
			this.nodeLoading.set(false);
		});

		effect(async () => {
			const request = this.regionRequest();
			if (!request) return;
			this.edgeLoading.set(true);
			const data = await this._requestService.getIntersectionEdgeProperties({
				...request,
				page: 0,
				size: 1000
			});
			this.edgeProperties.set(data.properties);
			this.edgeLoading.set(false);
		});

		effect(async () => {
			const request = this.regionRequest();
			if (!request) return;
			this.rideLoading.set(true);
			const data = await this._requestService.getIntersectionRideRegionMetricsProperties({
				...request,
				page: 0,
				size: 1000
			})
			this.rideProperties.set(data.properties);
			this.rideLoading.set(false);
		});
	}


	protected readonly RIDE_CHART_CONFIG: ChartConfig<RegionMetricData> = {
		selectableProperties: [
			{
				value: 'nodesPerKm',
				label: "Intersections On Distance (#/km)"
			},
			{
				value: 'nodeMedianWaitingTime',
				label: "Median Intersection Waiting Time (s)"
			},
			{
				value: 'nodeWaitingSPerKm',
				label: "Intersection Waiting Time (s/km)"
			},
			{
				value: 'nodeWaitingRate',
				label: "Intersection Waiting Rate (%)"
			},
			{
				value: 'nodeWaitingTime',
				label: "Total Intersection Waiting Time (s)"
			},
			{
				value: 'length',
				label: "Length (km)"
			},
			{
				value: 'duration',
				label: "Duration (s)"
			}
		],
		defaultProperty: 'nodeWaitingRate',
		defaultProperty2: 'length'
	};
	protected readonly REGION_CHART_CONFIG: ChartConfig<RegionMetric> = {
		selectableProperties: [
			{
				value: 'numberOfRides',
				label: "Number of Rides (#)"
			},
			...this.RIDE_CHART_CONFIG.selectableProperties
		],
		defaultProperty: 'numberOfRides',
		defaultProperty2: 'length'
	};
	protected loadRegionMetric = async (req: RegionMetricRequest) => {
		const data = await this._requestService.getIntersectionRegionMetricsPageable(req);
		if (data.geoData.features.length === 1) return mapRegionMetricToRows(data.geoData)[0];
		return null;
	};
	protected loadEdgeMetric = (req: EdgePageableMetricRequest, page: number, size: number) => {
		return this._requestService.getIntersectionEdgeMetricsPageableProperties({ ...req, page, size });
	};
	protected loadNodeMetric = (req: NodePageableMetricRequest, page: number, size: number) => {
		return this._requestService.getIntersectionNodeMetricsPageableProperties({ ...req, page, size });
	};
	protected loadEdges = (req: EdgePageableRequest, page: number, size: number) => {
		return this._requestService.getIntersectionEdgeProperties({ ...req, page, size });
	};
	protected loadNodes = (req: NodePageableRequest, page: number, size: number) => {
		return this._requestService.getIntersectionNodeProperties({ ...req, page, size });
	};
	protected loadRides = (req: RegionMetricRequest, page: number, size: number) => {
		return this._requestService.getIntersectionRideRegionMetricsProperties({ ...req, page, size });
	};
	protected readonly baseConfig = BASE_CHART_CONFIG;
	protected readonly BASE_METRIC_CHART_CONFIG = BASE_METRIC_CHART_CONFIG;
}
