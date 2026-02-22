import { Component, effect, input, Input, signal, inject, numberAttribute } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IntersectionsRequestService } from '@simra/intersections-domain';
import {
	RegionMetricRow,
	RegionMetricRequest
} from '@simra/intersections-common';
import { OverviewRegionDetail } from '../../components/overview/overview'
import { Feature, FeatureCollection, GeoJsonProperties, LineString, Point, Polygon } from 'geojson';
import { EYear, ETrafficTimes, EWeekDays } from '@simra/common-models';

@Component({
	selector: 'region-detail',
	imports: [CommonModule, OverviewRegionDetail],
	templateUrl: './region-detail.html'
})
export class IntersectionsRegionDetail {
	private readonly _requestService = inject(IntersectionsRequestService);
	protected readonly regionId = input<string>();
	protected readonly regionName = signal<string>("");
	protected readonly regionAggregate = signal<FeatureCollection<Polygon, GeoJsonProperties> | undefined>(undefined);

	constructor() {
		effect(async () => {
			const regionId = Number(this.regionId());
			if (!regionId) return;
			const data = await this._requestService.getIntersectionRegionMetricsPageable({
				regionId: regionId,
				numberOfRides: 0,
				weekDay: EWeekDays.ALL_WEEK,
				trafficTime: ETrafficTimes.ALL_DAY,
				year: EYear.ALL
			});
			this.regionAggregate.set(data.geoData);
			if (data.geoData.features.length === 1) {
				const name = data.geoData.features[0].properties?.["name"];
				this.regionName.set(name);
			}
		});
	}
}
