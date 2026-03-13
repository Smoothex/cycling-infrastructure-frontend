import { Component, effect, input, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Card } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { Select } from 'primeng/select';
import { InputNumber } from 'primeng/inputnumber';
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
	createHistogram,
} from '@simra/intersections-common';
import { EYear, ETrafficTimes, EWeekDays,  } from '@simra/common-models';

const ChartPropertyLabels = {
	nodesPerKm: "Intersections On Distance (#/km)",
	nodeMedianWaitingTime: "Median Intersection Waiting Time (s)",
	nodeWaitingSPerKm: "Intersection Waiting Time (s/km)",
	length: "Length (km)"
}


@Component({
	selector: 'region-detail',
	imports: [CommonModule, FormsModule, Card, ChartModule, TableModule, Divider, Select, InputNumber, IntersectionMap, IntersectionChart, DateFilterPrecomputed],
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

	protected readonly nodeProperties = signal<Base[]>([]);
	protected readonly edgeProperties = signal<Base[]>([]);
	protected readonly rideProperties = signal<RideRegionMetric[]>([]);

	protected readonly propertyOptions = Object.entries(ChartPropertyLabels).map(([value, label]) => ({
			label,
			value: value as keyof typeof ChartPropertyLabels
	}));
	protected propertyChart = signal<keyof typeof ChartPropertyLabels>("length");
	protected bucketSize = signal<number>(0.5);
	protected offset = signal<number>(5);
	protected readonly histogram = computed(() => {
		const props = this.rideProperties();
		const selected = this.propertyChart(); 
		const size = this.bucketSize();
		const offset = this.offset();
		return createHistogram(props.map(r => r[selected]), size, offset, ChartPropertyLabels[selected], 'Number of Rides');
	});

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

			const data = await this._requestService.getIntersectionRegionMetricsPageable(request);
			this.regionFeature.set(data.geoData);
			const regions: RegionMetricRow[] = mapRegionMetricToRows(data.geoData);
			if (regions.length === 1) {
				this.region.set(regions[0]);
			}
		});

		effect(async () => {
			const request = this.regionRequest();
			if (!request) return;

			this.nodeProperties.set(await this._requestService.getIntersectionNodePropertiesByRegionId(request));
		});

		effect(async () => {
			const request = this.regionRequest();
			if (!request) return;

			this.edgeProperties.set(await this._requestService.getIntersectionEdgePropertiesByRegionId(request));
		});

		effect(async () => {
			const request = this.regionRequest();
			if (!request) return;

			this.rideProperties.set(await this._requestService.getIntersectionRideRegionMetricsProperties(request));
			console.log(this.rideProperties());
		});
	}
}
