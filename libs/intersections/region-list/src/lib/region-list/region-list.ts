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
import {
	EnumColumn,
	EnumMultiSelectComponent,
	isEnumColumn,
	isNumberColumn, AutocompleteComponent,
	NumberColumn,
	NumberFilterComponent,
	TRAFFIC_TIMES_TO_TRANSLATION,
	WEEK_DAYS_TO_TRANSLATION, YEAR_TO_TRANSLATION, AutocompleteColumn, isAutocompleteColumn, LastRunComponent,
} from '@simra/common-components';
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
		{ field: 'name', header: 'Name', sortable: true,  }, // display: "regionLink"
		{ field: 'numberOfRides', header: 'Count', sortable: true },
		{ field: 'nodeMedianWaitingTime', header: 'Median Waiting Node', sortable: true, display: "decimal" },
		{ field: 'length', header: 'Length (km)', sortable: true, display: "decimal" },
		{ field: 'nodeWaitingPerKm', header: 'Node Waiting (s/km)', sortable: true, display: "decimal" },
		{ field: 'nodeMedianWaitingPerKm', header: 'Node Median Waiting (s/km)', sortable: true, display: "decimal" },
		{ field: 'edgeWaitingPerKm', header: 'Edge Waiting (s/km)', sortable: true, display: "decimal" },
		{ field: 'edgeMedianWaitingPerKm', header: 'Edge Median Waiting (s/km)', sortable: true, display: "decimal" }
	];

	protected readonly loading = signal(false);
	protected readonly rows = signal<RegionAggregateRow[]>([]);

	async load() {
		this.loading.set(true);
		this.rows.set(mapIntersectionRegionAggregateToRows(await this._intersectionsRegionFacade.getRegionAggregate()));
  		this.loading.set(false);
	}

	ngOnInit() {
		this.load();
	}
}
