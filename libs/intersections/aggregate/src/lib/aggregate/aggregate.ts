import { Component, effect, input, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IntersectionsAggregateList } from '../../components/list/list-aggregate'
import { IntersectionsAggregateMap } from '../../components/map/map-aggregate'
import { Card } from 'primeng/card';
import { IntersectionsAggregateFacade } from '@simra/intersections-domain';
import { Feature, FeatureCollection, GeoJsonProperties, LineString, Point, Polygon } from 'geojson';

@Component({
	selector: 'lib-aggregate',
	imports: [CommonModule, IntersectionsAggregateList, IntersectionsAggregateMap, Card],
	templateUrl: './aggregate.html',
})
export class IntersectionsAggregatePage {
	private readonly _intersectionsAggregateFacade = inject(IntersectionsAggregateFacade);
	intersectionNodeAggregate = signal<FeatureCollection<LineString> | undefined>(undefined);
	trafficSignalClusterId = input.required<number>();

	constructor() {
		effect(async () => {
			const id = this.trafficSignalClusterId();
			if (!id) return;
			this.intersectionNodeAggregate.set(await this._intersectionsAggregateFacade.getIntersectionNodeAggregateWithFilter(id));
		});
	}
}
