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
	PagedProperties,
	RouteParamUtilityService
} from '@simra/intersections-common';
import { IntersectionsRegionRequestService, IntersectionRegionTreeComponent } from '@simra/intersections-domain';
import { EAdminLevel, AdminLevelTranslationMap  } from '@simra/regions-browse';


@Component({
	selector: 'intersection-region-list',
	imports: [FormsModule, TableModule, Card, 
		IntersectionListContentComponent, IntersectionListHeaderComponent, IntersectionListHeaderFilterComponent, IntersectionRegionTreeComponent],
	templateUrl: './region-list.html'
})
export class IntersectionsRegionListComponent {
	private readonly _requestService = inject(IntersectionsRegionRequestService);
	private readonly _routeService = inject(RouteParamUtilityService);

	protected readonly initialValues: RegionPageableRequest = {
		numberOfRides: this._routeService.getInitialParam('numberOfRides', 10, Number),
		regionLTreePath: this._routeService.getInitialParam('regionLTreePath', undefined),
		adminLevel: this._routeService.getInitialParam('adminLevel', EAdminLevel.FEDERAL_COUNTY),
		weekDay: this._routeService.getInitialParam('weekDay', EWeekDays.ALL_WEEK),
		trafficTime: this._routeService.getInitialParam('trafficTime', ETrafficTimes.ALL_DAY),
		year: this._routeService.getInitialParam('year', EYear.ALL),
		page: this._routeService.getInitialParam('page', 0, Number),
		size: this._routeService.getInitialParam('size', 20, Number),
		sort: this._routeService.getInitialParam('sort', "numberOfRides,DESC")
	}

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
			headerFilter: { enum: EAdminLevel, default: this.initialValues.adminLevel }
		},
		{ 
			field: 'numberOfRides', 
			header: 'INTERSECTIONS.HEADERS.RIDES', 
			sortable: true ,
			display: "number",
			headerFilter: { step: 5, min: 0, default: this.initialValues.numberOfRides }
		},
		{ 
			field: 'length',
			header: 'INTERSECTIONS.HEADERS.LENGTHKM',
			sortable: false, 
			display: "number" 
		},
		{ 
			field: 'nodeAvgWaitingTime', 
			header: 'INTERSECTIONS.HEADERS.NODEMEDIANWAITINGTIME',
			sortable: false, 
			display: "number" 
		},
		{ 
			field: 'nodeWaitingSPerKm', 
			header: 'INTERSECTIONS.HEADERS.NODEMEDIANWAITINGTIMEDISTANCE', 
			sortable: false, 
			display: "number" 
		},
		{
			field: 'weekDay', 
			header: 'INTERSECTIONS.HEADERS.WEEKDAY',
			sortable: false,
			display: "enum",
			translationMap: WEEK_DAYS_TO_TRANSLATION, 
			headerFilter: { enum: EWeekDays, default: this.initialValues.weekDay } 
		},
		{ 
			field: 'trafficTime',
			header: 'INTERSECTIONS.HEADERS.TRAFFICTIME', 
			sortable: false,
			display: "enum", 
			translationMap: TRAFFIC_TIMES_TO_TRANSLATION,
			headerFilter: { enum: ETrafficTimes, default: this.initialValues.trafficTime }	
		},
		{ 
			field: 'year', 
			header: 'INTERSECTIONS.HEADERS.YEAR',
			sortable: false,
			display: "enum", 
			translationMap: YEAR_TO_TRANSLATION, 
			headerFilter: { enum: EYear, default: this.initialValues.year } 
		}
	];

	protected readonly loading = signal(false);
	protected readonly rows = computed<RegionMetricRow[]>(() => {
		const response = this.pagedResponse();
		if (!response) return [];
        return response.properties;
	});
	protected readonly requestFilter = signal<RegionPageableRequest>({ ...this.initialValues });

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
			this._routeService.applyParams(request);
			this.loading.set(false);
		});
	}

	onFilterChange (event: TableFilterEvent) {
		onFilterChangeHelper(event, this.requestFilter);
	}

	onLazy(event: TableLazyLoadEvent) { 
		onLazyHelper(event, this.requestFilter);
	}

	onRegionChange (regionLTreePath: string | null) {
		onFilterChangeHelper({ regionLTreePath: regionLTreePath }, this.requestFilter)
	}
}
