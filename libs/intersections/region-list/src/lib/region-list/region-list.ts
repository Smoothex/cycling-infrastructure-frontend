import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IntersectionsRequestService } from '@simra/intersections-domain';
import {
	ListColumn,
	RegionMetricRow,
	mapRegionMetricToRows
} from '@simra/intersections-common';
import { ETrafficTimes, EWeekDays, EYear } from '@simra/common-models';
import { TableModule } from 'primeng/table';
import { IntersectionList } from '@simra/intersections-common';

@Component({
	selector: 'region-list',
	imports: [CommonModule, FormsModule, TableModule, IntersectionList],
	templateUrl: './region-list.html'
})
export class IntersectionsRegionList {
	private readonly _requestService = inject(IntersectionsRequestService);

	protected readonly columns: ListColumn<RegionMetricRow>[] = [
		{ field: 'regionIdLink', header: 'regionId', sortable: true, display: "link" }, // display: "regionLink"
		{ field: 'name', header: 'Name', sortable: true,  }, 
		{ field: 'numberOfRides', header: 'Count', sortable: true },
		{ field: 'nodeMedianWaitingTime', header: 'Median Waiting Node', sortable: true, display: "decimal" },
		{ field: 'length', header: 'Length (km)', sortable: true, display: "decimal" },
		{ field: 'nodeWaitingSPerKm', header: 'Node Waiting (s/km)', sortable: true, display: "decimal" },
		{ field: 'edgeWaitingSPerKm', header: 'Edge Waiting (s/km)', sortable: true, display: "decimal" },
	];

	protected readonly loading = signal(false);
	protected readonly rows = signal<RegionMetricRow[]>([]);

	async load() {
		this.loading.set(true);
		const data = await this._requestService.getIntersectionRegionMetricsPageable({
			numberOfRides: 0,
			weekDay: EWeekDays.ALL_WEEK,
			trafficTime: ETrafficTimes.ALL_DAY,
			year: EYear.ALL
		});
		this.rows.set(mapRegionMetricToRows(data.geoData));
  		this.loading.set(false);
	}

	ngOnInit() {
		this.load();
	}
}
