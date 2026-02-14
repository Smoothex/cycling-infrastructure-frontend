import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IntersectionsRegionFacade } from '@simra/intersections-domain';
import {
	ListColumn,
	RegionAggregateRow,
	mapIntersectionRegionAggregateToRows
} from '@simra/intersections-common';
import { ETrafficTimes, EWeekDays, EYear } from '@simra/common-models';
import { TranslateModule, TranslatePipe } from '@ngx-translate/core';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';

@Component({
	selector: 'region-list',
	imports: [CommonModule, FormsModule, Card, TableModule, RouterLink],
	templateUrl: './region-list.html'
})
export class IntersectionsRegionList {
	private readonly _intersectionsRegionFacade = inject(IntersectionsRegionFacade);

	protected readonly columns: ListColumn<RegionAggregateRow>[] = [
		{ field: 'name', header: 'regionId', sortable: true,  }, // display: "regionLink"
		{ field: 'name', header: 'Name', sortable: true,  }, 
		{ field: 'numberOfRides', header: 'Count', sortable: true },
		{ field: 'nodeMedianWaitingTime', header: 'Median Waiting Node', sortable: true, display: "decimal" },
		{ field: 'length', header: 'Length (km)', sortable: true, display: "decimal" },
		{ field: 'nodeWaitingSPerKm', header: 'Node Waiting (s/km)', sortable: true, display: "decimal" },
		{ field: 'edgeWaitingSPerKm', header: 'Edge Waiting (s/km)', sortable: true, display: "decimal" },
	];

	protected readonly loading = signal(false);
	protected readonly rows = signal<RegionAggregateRow[]>([]);

	async load() {
		this.loading.set(true);
		const data = await this._intersectionsRegionFacade.getRegionAggregate({
			numberOfRides: 0,
			weekDay: EWeekDays.ALL_WEEK,
			trafficTime: ETrafficTimes.ALL_DAY,
			year: EYear.ALL
		});
		this.rows.set(mapIntersectionRegionAggregateToRows(data.geoData));
  		this.loading.set(false);
	}

	ngOnInit() {
		this.load();
	}
}
