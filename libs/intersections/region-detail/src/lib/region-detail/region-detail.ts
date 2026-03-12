import { Component, effect, input, Input, signal, inject, numberAttribute } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { Divider } from 'primeng/divider';
import { FeatureCollection, GeoJsonProperties,  Polygon } from 'geojson';
import { IntersectionsRequestService } from '@simra/intersections-domain';
import {
	Base,
	DateFilterPrecomputed,
	DATE_FILTER_DEFAULTS,
	RegionMetricRow,
	RegionMetricRequest,
	mapRegionMetricToRows,
	IntersectionMap,
	IntersectionChart
} from '@simra/intersections-common';
import { EYear, ETrafficTimes, EWeekDays,  } from '@simra/common-models';


@Component({
	selector: 'region-detail',
	imports: [CommonModule, Card, TableModule, Divider, IntersectionMap, IntersectionChart, DateFilterPrecomputed],
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
	protected readonly region = signal<RegionMetricRow | undefined>(undefined);
	protected readonly regionFeature = signal<FeatureCollection<Polygon, GeoJsonProperties> | undefined>(undefined);

	protected readonly nodeProperties = signal<Base[]>([]);
	protected readonly edgeProperties = signal<Base[]>([]);

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
	}
}
