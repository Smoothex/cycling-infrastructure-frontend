import { Component, effect, input, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Card } from 'primeng/card';
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
	RegionMetricRow,
	RegionMetricRequest,
	mapRegionMetricToRows,
	IntersectionMap,
	IntersectionChart,
	RideRegionMetric,
	ChartConfig,
	BASE_CHART_CONFIG,
} from '@simra/intersections-common';
import { EYear, ETrafficTimes, EWeekDays,  } from '@simra/common-models';


@Component({
	selector: 'region-detail',
	imports: [CommonModule, FormsModule, Card, ChartModule, TableModule, Divider, IntersectionMap, IntersectionChart, DateFilterPrecomputed],
	templateUrl: './region-detail.html'
})
export class IntersectionsRegionDetail {
	private readonly _requestService = inject(IntersectionsRequestService);

	private regionRequest = signal<RegionMetricRequest | null>(null);
	protected _selectedYear = signal<EYear>(DATE_FILTER_DEFAULTS.year);
    protected _selectedWeekDays = signal<EWeekDays>(DATE_FILTER_DEFAULTS.weekDays);
    protected _selectedTrafficTime = signal<ETrafficTimes>(DATE_FILTER_DEFAULTS.trafficTime);

	protected readonly trafficSignalClusterId = NaN;
	protected readonly regionId = input<string>();
	protected readonly region = signal<RegionMetric | undefined>(undefined);
	protected readonly regionFeature = signal<FeatureCollection<Polygon, GeoJsonProperties> | undefined>(undefined);
	protected readonly mapLoading = signal<boolean>(true);

	protected readonly nodeProperties = signal<Base[]>([]);
	protected readonly nodeLoading = signal<boolean>(true);
	protected readonly edgeProperties = signal<Base[]>([]);
	protected readonly edgeLoading = signal<boolean>(true);
	protected readonly rideProperties = signal<RideRegionMetric[]>([]);
	protected readonly rideLoading = signal<boolean>(true);

	
	protected readonly rideConfig: ChartConfig<RideRegionMetric> = {
		labels: {
			regionId: "",
			rideId: "",
			trafficTime: "",
			weekDay: "",
			year: "",
			name: "", 
			adminLevel: "", 
			numberOfEdges: "", 
			numberOfNodes: "",
			edgeWaitingSPerKm: "",
			nodesPerKm: "Intersections On Distance (#/km)",
			nodeMedianWaitingTime: "Median Intersection Waiting Time (s)",
			nodeWaitingSPerKm: "Intersection Waiting Time (s/km)",
			length: "Length (km)"
		},
		selectableProperties: ['nodesPerKm', 'nodeMedianWaitingTime', 'nodeWaitingSPerKm', 'length'],
		defaultProperty: 'nodeMedianWaitingTime',
		defaultProperty2: 'nodesPerKm'
	};
	protected readonly baseConfig = BASE_CHART_CONFIG;

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
			this.nodeProperties.set(await this._requestService.getIntersectionNodePropertiesByRegionId(request));
			this.nodeLoading.set(false);
		});

		effect(async () => {
			const request = this.regionRequest();
			if (!request) return;
			this.edgeLoading.set(true);
			this.edgeProperties.set(await this._requestService.getIntersectionEdgePropertiesByRegionId(request));
			this.edgeLoading.set(false);
		});

		effect(async () => {
			const request = this.regionRequest();
			if (!request) return;
			this.rideLoading.set(true);
			this.rideProperties.set(await this._requestService.getIntersectionRideRegionMetricsProperties(request));
			this.rideLoading.set(false);
		});
	}
}
