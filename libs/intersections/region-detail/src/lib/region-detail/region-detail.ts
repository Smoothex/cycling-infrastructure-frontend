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
import { IntersectionsRequestService, mapFeaturesToRegionMetricRows } from '@simra/intersections-domain';
import {
	Base,
	DateFilterPrecomputed,
	DATE_FILTER_DEFAULTS,
	RegionMetricRow,
	RegionPageableRequest,
	IntersectionMap,
	IntersectionChart,
	IntersectionChartMetric,
	RideRegionMetric,
	BASE_CHART_CONFIG,
	EdgePageableRequestPrecomputed,
	NodePageableRequestPrecomputed,
	BASE_METRIC_CHART_CONFIG,
	NODE_METRIC_CHART_CONFIG,
	EdgePageableMetricRequest,
	NodePageableMetricRequest,
	RIDE_CHART_CONFIG,
	RegionMetric,
	REGION_CHART_CONFIG
} from '@simra/intersections-common';
import { EYear, ETrafficTimes, EWeekDays,  } from '@simra/common-models';
import { area } from '@turf/turf';


@Component({
	selector: 'region-detail',
	imports: [CommonModule, FormsModule, ButtonModule, Card, ChartModule, TableModule, Divider, TranslatePipe, RouterLink,
		IntersectionMap, IntersectionChart, IntersectionChartMetric, DateFilterPrecomputed],
	templateUrl: './region-detail.html'
})
export class IntersectionsRegionDetail {
	private readonly _requestService = inject(IntersectionsRequestService);

	protected readonly regionRequest = signal<RegionPageableRequest | null>(null);
	protected _selectedYear = signal<EYear>(DATE_FILTER_DEFAULTS.year);
    protected _selectedWeekDays = signal<EWeekDays>(DATE_FILTER_DEFAULTS.weekDays);
    protected _selectedTrafficTime = signal<ETrafficTimes>(DATE_FILTER_DEFAULTS.trafficTime);

	protected readonly trafficSignalClusterId = NaN;
	protected readonly regionId = input<string>();
	protected readonly region = signal<RegionMetricRow | undefined>(undefined);
	protected readonly regionFeature = signal<FeatureCollection<Polygon, GeoJsonProperties> | undefined>(undefined);
	protected readonly regionZoom = computed(() => {
		const region = this.region();
		if (!region) return;
		return region.mapLink.params;
	});
	protected readonly regionArea = computed(() => {
		const feature = this.regionFeature();
		if (!feature) return 0;
		return area(feature) / 1000000;
	})
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
				year: this._selectedYear(),
				page: 0,
				size: 10,
			});
		});

		effect(async () => {
			const request = this.regionRequest();
			if (!request) return;
			this.mapLoading.set(true);
			const data = await this._requestService.getIntersectionRegionMetricsPageable(request);
			this.regionFeature.set(data.geoData);
			const regions: RegionMetricRow[] = mapFeaturesToRegionMetricRows(data.geoData);
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


	protected readonly RIDE_CHART_CONFIG = RIDE_CHART_CONFIG;
	protected readonly REGION_CHART_CONFIG = REGION_CHART_CONFIG;
	protected loadRegionMetric = async (req: RegionPageableRequest): Promise<RegionMetric | null> => {
		const data = await this._requestService.getIntersectionRegionMetricsPageableProperties(req);
		if (data.properties.length === 1) return data.properties[0];
		return null;
	};
	protected loadEdgeMetric = (req: EdgePageableMetricRequest, page: number, size: number) => {
		return this._requestService.getIntersectionEdgeMetricsPageableProperties({ ...req, page, size });
	};
	protected loadNodeMetric = (req: NodePageableMetricRequest, page: number, size: number) => {
		return this._requestService.getIntersectionNodeMetricsPageableProperties({ ...req, page, size });
	};
	protected loadEdges = (req: EdgePageableRequestPrecomputed, page: number, size: number) => {
		return this._requestService.getIntersectionEdgeProperties({ ...req, page, size });
	};
	protected loadNodes = (req: NodePageableRequestPrecomputed, page: number, size: number) => {
		return this._requestService.getIntersectionNodeProperties({ ...req, page, size });
	};
	protected loadRides = (req: RegionPageableRequest, page: number, size: number) => {
		return this._requestService.getIntersectionRideRegionMetricsProperties({ ...req, page, size });
	};
	protected readonly baseConfig = BASE_CHART_CONFIG;
	protected readonly BASE_METRIC_CHART_CONFIG = BASE_METRIC_CHART_CONFIG;
	protected readonly NODE_METRIC_CHART_CONFIG = NODE_METRIC_CHART_CONFIG;
}
