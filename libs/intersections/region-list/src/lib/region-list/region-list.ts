import { Component, inject, signal, computed, effect, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Card } from 'primeng/card';
import { TableModule, TableFilterEvent, TableLazyLoadEvent } from 'primeng/table';
import { Polygon } from 'geojson';
import { ESortOrder, ETrafficTimes, EWeekDays, EYear } from '@simra/common-models';
import {
	TRAFFIC_TIMES_TO_TRANSLATION,
	WEEK_DAYS_TO_TRANSLATION, 
	YEAR_TO_TRANSLATION
} from '@simra/common-components';
import { 
	ListColumn,
	RegionMetricRow,
	mapRegionMetricToRows,
	IntersectionListContent, 
	IntersectionListHeader,
	IntersectionListHeaderFilter,
	RegionMetricRequest,
	PagedGeoResponse,
	onFilterChangeHelper,
	onLazyHelper
} from '@simra/intersections-common';
import { IntersectionsRequestService } from '@simra/intersections-domain';
import { EAdminLevel, AdminLevelTranslationMap  } from '@simra/regions-browse';

const defaults: RegionMetricRequest = {
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
	selector: 'region-list',
	imports: [CommonModule, FormsModule, TableModule, Card, IntersectionListContent, IntersectionListHeader, IntersectionListHeaderFilter],
	templateUrl: './region-list.html'
})
export class IntersectionsRegionList {
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
			field: 'nodeMedianWaitingTime', 
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
		const response = this.pagedGeoResponse();
		if (!response) return [];
        return mapRegionMetricToRows(response.geoData);
	});
	protected readonly requestFilter = signal<RegionMetricRequest>({ ...defaults });

	protected readonly pagedGeoResponse = signal<PagedGeoResponse<Polygon> | null>(null);
	protected readonly totalElements = computed(() => {
        const response = this.pagedGeoResponse();
        return response?.metadata?.totalElements ? response.metadata.totalElements : 0;
    });

	constructor () {
		effect(async () => {
			const request = this.requestFilter();
			this.loading.set(true);
			this.pagedGeoResponse.set(await this._requestService.getIntersectionRegionMetricsPageable(request));
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
