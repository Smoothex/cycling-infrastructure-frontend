import { Component, inject, signal, computed, effect } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { Card } from 'primeng/card';
import { TableModule, TableFilterEvent, TableLazyLoadEvent } from 'primeng/table';
import { ETrafficTimes, EWeekDays, EYear } from '@simra/common-models';
import {
	TRAFFIC_TIMES_TO_TRANSLATION,
	WEEK_DAYS_TO_TRANSLATION, 
	YEAR_TO_TRANSLATION
} from '@simra/common-components';
import { 
	ListColumn,
	RegionMetricRow,
	IntersectionListContentComponent, 
	IntersectionListHeaderComponent,
	IntersectionListHeaderFilterComponent,
	RegionPageableRequest,
	onFilterChangeHelper,
	onLazyHelper,
	PagedProperties
} from '@simra/intersections-common';
import { IntersectionsRequestService } from '@simra/intersections-domain';
import { EAdminLevel, AdminLevelTranslationMap  } from '@simra/regions-browse';

const defaults: RegionPageableRequest = {
	numberOfRides: 10,
	adminLevel: EAdminLevel.FEDERAL_COUNTY,
	weekDay: EWeekDays.ALL_WEEK,
	trafficTime: ETrafficTimes.ALL_DAY,
	year: EYear.ALL,
	page: 0,
	size: 20,
	sort: "nodeWaitingSPerKm,DESC"
}

@Component({
	selector: 'intersection-region-list',
	imports: [FormsModule, TableModule, Card, IntersectionListContentComponent, IntersectionListHeaderComponent, IntersectionListHeaderFilterComponent],
	templateUrl: './region-list.html'
})
export class IntersectionsRegionListComponent {
	private readonly _requestService = inject(IntersectionsRequestService);

	protected readonly columns: ListColumn<RegionMetricRow>[] = [
		{ 
			field: 'regionIdLink', 
			header: 'Id', 
			sortable: true, 
			display: "link" 
		},
		{ 
			field: 'name', 
			header: 'Name', 
			sortable: true,
			display: "text"
		},
		{ 
			field: 'adminLevel', 
			header: 'AdminLevel', 
			sortable: false,
			display: "enum", 
			translationMap: AdminLevelTranslationMap,
			headerFilter: { enum: EAdminLevel, default: defaults.adminLevel }
		},
		{ 
			field: 'numberOfRides', 
			header: 'INTERSECTIONS.HEADERS.RIDES', 
			sortable: true ,
			display: "number",
			headerFilter: { step: 5, min: 0, default: defaults.numberOfRides }
		},
		{ 
			field: 'length',
			header: 'INTERSECTIONS.HEADERS.LENGTHKM',
			sortable: true, 
			display: "number" 
		},
		{ 
			field: 'nodeAvgWaitingTime', 
			header: 'INTERSECTIONS.HEADERS.NODEMEDIANWAITINGTIME',
			sortable: true, 
			display: "number" 
		},
		{ 
			field: 'nodeWaitingSPerKm', 
			header: 'INTERSECTIONS.HEADERS.NODEMEDIANWAITINGTIMEDISTANCE', 
			sortable: true, 
			display: "number" 
		},
		{
			field: 'weekDay', 
			header: 'INTERSECTIONS.HEADERS.WEEKDAY',
			sortable: false,
			display: "enum",
			translationMap: WEEK_DAYS_TO_TRANSLATION, 
			headerFilter: { enum: EWeekDays, default: defaults.weekDay } 
		},
		{ 
			field: 'trafficTime',
			header: 'INTERSECTIONS.HEADERS.TRAFFICTIME', 
			sortable: false,
			display: "enum", 
			translationMap: TRAFFIC_TIMES_TO_TRANSLATION,
			headerFilter: { enum: ETrafficTimes, default: defaults.trafficTime }	
		},
		{ 
			field: 'year', 
			header: 'INTERSECTIONS.HEADERS.YEAR',
			sortable: false,
			display: "enum", 
			translationMap: YEAR_TO_TRANSLATION, 
			headerFilter: { enum: EYear, default: defaults.year } 
		}
	];

	protected readonly loading = signal(false);
	protected readonly rows = computed<RegionMetricRow[]>(() => {
		const response = this.pagedResponse();
		if (!response) return [];
        return response.properties;
	});
	protected readonly requestFilter = signal<RegionPageableRequest>({ ...defaults });

	protected readonly pagedResponse = signal<PagedProperties<RegionMetricRow> | null>(null);
	protected readonly totalElements = computed(() => {
        const response = this.pagedResponse();
        return response?.metadata?.totalElements ? response.metadata.totalElements : 0;
    });

	constructor () {
		effect(async () => {
			const request = this.requestFilter();
			this.loading.set(true);
			this.pagedResponse.set(await this._requestService.getIntersectionRegionMetricsPageableProperties(request));
			this.loading.set(false);
		});
	}

	onFilterChange (event: TableFilterEvent) {
		onFilterChangeHelper(event, this.requestFilter);
	}

	onLazy(event: TableLazyLoadEvent) { 
		onLazyHelper(event, this.requestFilter);
	}
}
