import { Component, effect, input, Input, signal, inject, numberAttribute } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IntersectionsRegionFacade } from '@simra/intersections-domain';
import {
	RegionAggregateRow,
	RegionAggregateRequest
} from '@simra/intersections-common';
import { OverviewRegionDetail } from '../../components/overview/overview'
import { Feature, FeatureCollection, GeoJsonProperties, LineString, Point, Polygon } from 'geojson';

@Component({
	selector: 'region-detail',
	imports: [CommonModule, OverviewRegionDetail],
	templateUrl: './region-detail.html'
})
export class IntersectionsRegionDetail {
	private readonly _intersectionsRegionFacade = inject(IntersectionsRegionFacade);
	protected readonly regionName = input<string>();

	regionAggregate = signal<FeatureCollection<Polygon, GeoJsonProperties> | undefined>(undefined);

	constructor() {
		effect(async () => {
			const regionName = this.regionName();
			if (regionName) {
				// TODO: replace name with regionId
				//const data = await this._intersectionsRegionFacade.getRegionAggregate({ region: regionName });
				//this.regionAggregate.set(data);
			}
		});
	}
}
