import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LineString } from 'geojson';
import { IntersectionsRequestService } from '@simra/intersections-domain';
import { RegionRequestService } from '@simra/streets-domain';
import {
	NodePageableMetricRequest, 
	NodeMetricRow,
	mapNodeMetricToRows,
	EdgePageableMetricRequest,
	EdgeMetricRow,
	mapEdgeMetricToRows,
	ListColumn,
	PagedGeoResponse
} from '@simra/intersections-common';
import { TranslateModule, TranslatePipe } from '@ngx-translate/core';
import {
	EnumSelectComponent,
	AutocompleteComponent,
	NumberFilterComponent,
	TRAFFIC_TIMES_TO_TRANSLATION,
	WEEK_DAYS_TO_TRANSLATION, YEAR_TO_TRANSLATION, AutocompleteColumn, isAutocompleteColumn, LastRunComponent,
} from '@simra/common-components';
import { Observable } from 'rxjs';
import { Card } from 'primeng/card';
import { TableLazyLoadEvent, TableModule } from 'primeng/table';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { ESortOrder, ETrafficTimes, EWeekDays, EYear } from '@simra/common-models';

@Component({
	selector: 'lib-list',
	imports: [CommonModule, FormsModule, Card, TableModule, ToggleButtonModule, RouterLink, 
		AutocompleteComponent, NumberFilterComponent, EnumSelectComponent, TranslatePipe],
	templateUrl: './list.html',
	styleUrl: './list.scss',
})
export class IntersectionsList {
	private readonly _requestService = inject(IntersectionsRequestService);
	private readonly _regionRequestService = inject(RegionRequestService);

	private readonly defaults = {
		trafficSignalClusterId: undefined,
		numberOfRides: 5,
		region: undefined,
		streetNames: undefined,
		name: undefined,
		weekDay: EWeekDays.ALL_WEEK,
		trafficTime: ETrafficTimes.ALL_DAY,
		year: EYear.ALL,
		page: 0,
		size: 20,
		sort: "medianWaitingTime,DESC"
	}

	protected readonly pagedGeoResponse = signal<PagedGeoResponse<LineString> | null>(null);
	protected readonly totalElements = computed(() => {
        const response = this.pagedGeoResponse();
        return response?.metadata?.totalElements ? response.metadata.totalElements : 0;
    });
	
	protected readonly nodeColumns: ListColumn<NodeMetricRow>[] = [
		{ field: 'trafficSignalClusterLink', header: 'INTERSECTIONS.HEADERS.INTERSECTIONID', sortable: true, display: "link" },
		{ field: 'clusterStartEndLink', header: 'INTERSECTIONS.HEADERS.STARTENDOSMID', display: "link" },
		// { field: 'endOsmId', header: 'End OSM ID' },
		{ field: 'streetNames', header: 'Name', sortable: true, headerFilter: {dataType: 'autocomplete', 
			field: 'streetNames',
			fetchFunction: (query: string): Observable<string[]> => {
				this.nodeFilter.streetNames = query;
				return this._requestService.getIntersectionNodeStreetNames(this.nodeFilter);
			} }},
		{ field: 'numberOfRides', header: 'INTERSECTIONS.HEADERS.RIDES', sortable: true, headerFilter: {dataType: 'number', field: 'numberOfRides', step: 5, min: 0, default: this.defaults.numberOfRides}},
		{ field: 'medianSpeed', header: 'INTERSECTIONS.HEADERS.SPEED', sortable: true, display: "decimal"  },
		{ field: 'medianLength', header: 'INTERSECTIONS.HEADERS.LENGTH', sortable: true, display: "decimal" },
		{ field: 'medianDuration', header: 'INTERSECTIONS.HEADERS.DURATION', sortable: true, display: "decimal"  },
		{ field: 'medianWaitingTime', header: 'INTERSECTIONS.HEADERS.MEDIANWAITINGTIME', sortable: true, display: "decimal" },
		{ field: 'maxWaitingTime', header: 'INTERSECTIONS.HEADERS.MAXWAITINGTIME', sortable: true, display: "decimal" },
		{ field: 'weekDay', header: 'INTERSECTIONS.HEADERS.WEEKDAY', display: "enum", translationMap: WEEK_DAYS_TO_TRANSLATION, headerFilter: {dataType: "enum", field: 'weekDay', translationMap: WEEK_DAYS_TO_TRANSLATION, enum: EWeekDays, default: this.defaults.weekDay} },
		{ field: 'trafficTime', header: 'INTERSECTIONS.HEADERS.TRAFFICTIME', display: "enum", translationMap: TRAFFIC_TIMES_TO_TRANSLATION, headerFilter: {dataType: "enum", field: 'trafficTime', translationMap: TRAFFIC_TIMES_TO_TRANSLATION, enum: ETrafficTimes, default: this.defaults.trafficTime} },
		{ field: 'year', header: 'INTERSECTIONS.HEADERS.YEAR', display: "enum", translationMap: YEAR_TO_TRANSLATION, headerFilter: {dataType: "enum", field: 'year', translationMap: YEAR_TO_TRANSLATION, enum: EYear, default: this.defaults.year} }
	];
	protected nodeFilter: NodePageableMetricRequest = {
		trafficSignalClusterId: this.defaults.trafficSignalClusterId,
		numberOfRides: this.defaults.numberOfRides,
		region: this.defaults.region,
		streetNames: this.defaults.streetNames,
		weekDay: this.defaults.weekDay,
		trafficTime: this.defaults.trafficTime,
		year: this.defaults.year,
		page: this.defaults.page,
		size: this.defaults.size,
		sort: this.defaults.sort
	};

	protected readonly edgeColumns: ListColumn<EdgeMetricRow>[] = [
		{ field: 'prevOsmNextLink', header: 'INTERSECTIONS.HEADERS.PREVOSMNEXTID', display: "link" },
		{ field: 'name', header: 'Name', sortable: true, headerFilter: {dataType: 'autocomplete', 
			field: 'name',
			fetchFunction: (query: string): Observable<string[]> => {
				this.edgeFilter.name = query;
				return this._requestService.getIntersectionEdgeStreetNames(this.edgeFilter);
			} }},
		{ field: 'numberOfRides', header: 'INTERSECTIONS.HEADERS.RIDES', sortable: true, headerFilter: {dataType: 'number', field: 'numberOfRides', step: 5, min: 0, default: this.defaults.numberOfRides} },
		{ field: 'medianSpeed', header: 'INTERSECTIONS.HEADERS.SPEED', sortable: true, display: "decimal"  },
		{ field: 'medianLength', header: 'INTERSECTIONS.HEADERS.LENGTH', sortable: true, display: "decimal" },
		{ field: 'medianDuration', header: 'INTERSECTIONS.HEADERS.DURATION', sortable: true, display: "decimal"  },
		{ field: 'medianWaitingTime', header: 'INTERSECTIONS.HEADERS.MEDIANWAITINGTIME', sortable: true, display: "decimal" },
		{ field: 'maxWaitingTime', header: 'INTERSECTIONS.HEADERS.MAXWAITINGTIME', sortable: true, display: "decimal" },
		{ field: 'weekDay', header: 'INTERSECTIONS.HEADERS.WEEKDAY', headerFilter: {dataType: "enum", field: 'weekDay', translationMap: WEEK_DAYS_TO_TRANSLATION, enum: EWeekDays, default: this.defaults.weekDay} },
		{ field: 'trafficTime', header: 'INTERSECTIONS.HEADERS.TRAFFICTIME', headerFilter: {dataType: "enum", field: 'trafficTime', translationMap: TRAFFIC_TIMES_TO_TRANSLATION, enum: ETrafficTimes, default: this.defaults.trafficTime} },
		{ field: 'year', header: 'INTERSECTIONS.HEADERS.YEAR', headerFilter: {dataType: "enum", field: 'year', translationMap: YEAR_TO_TRANSLATION, enum: EYear, default: this.defaults.year} }
	];
	protected edgeFilter: EdgePageableMetricRequest = {
		numberOfRides: this.defaults.numberOfRides,
		region: this.defaults.region,
		name: this.defaults.name,
		weekDay: this.defaults.weekDay,
		trafficTime: this.defaults.trafficTime,
		year: this.defaults.year,
		page: this.defaults.page,
		size: this.defaults.size,
		sort: this.defaults.sort
	};


	protected readonly loading = signal(false);
	protected readonly rows = signal<NodeMetricRow[] | EdgeMetricRow[]>([]);
	protected readonly requestFilter = signal<NodePageableMetricRequest | EdgePageableMetricRequest>(this.nodeFilter);
	protected columns: ListColumn<NodeMetricRow>[] | ListColumn<EdgeMetricRow>[] = this.nodeColumns;
	public displayNodes = true;
	

	public fetchRegionNames = (query: string): Observable<string[]> => {
		return this._regionRequestService.fetchRegionNames(query);
	};

	async load() {
		console.log("LOAD")
		this.loading.set(true);
		if (this.displayNodes) {
			this.requestFilter.set(this.nodeFilter);
			const data = await this._requestService.getIntersectionNodeMetricsPageable(this.nodeFilter);
			this.pagedGeoResponse.set(data);
			this.rows.set(mapNodeMetricToRows(data.geoData));
		} else {
			this.requestFilter.set(this.edgeFilter);
			const data = await this._requestService.getIntersectionEdgeMetricsPageable(this.edgeFilter);
			this.pagedGeoResponse.set(data);
			this.rows.set(mapEdgeMetricToRows(data.geoData));
		}
  		this.loading.set(false);
	}

	onDisplayChange() {
		if (this.displayNodes) {
			this.columns = this.nodeColumns;
		} else {
			this.columns = this.edgeColumns;
		}
		this.load();
	}

	applyFilter<T>(event: any, keyMap: Record<string, keyof T>, filterObject: T) {
		let changed = false;
		Object.entries(keyMap).forEach(([eventKey, filterKey]) => {
			if (eventKey in event) {
				const newValue = event[eventKey] || undefined;

				if (filterObject[filterKey] !== newValue) {
					filterObject[filterKey] = newValue;
					changed = true;
				}
			}
		});

		return changed;
	}

	/**
	 * Called when paginating the table
	 * @param event
	 */
	onLazy(event: TableLazyLoadEvent) {
		if (event.rows && event.first !== undefined) {
			let sortField = event.sortField;
			if (sortField === "trafficSignalClusterLink") sortField = "trafficSignalClusterId";
			const order = event.sortOrder === 1 ? ESortOrder.ASC : ESortOrder.DESC;
			const sort = `${sortField},${order}`;

			if (this.displayNodes) {
				this.nodeFilter.page = event.first / event.rows;
				this.nodeFilter.size = event.rows;
				this.nodeFilter.sort = sort;
			} else {
				this.edgeFilter.page = event.first / event.rows;
				this.edgeFilter.size = event.rows;
				this.edgeFilter.sort = sort;
			}
			this.load();
		}
	}

	onFilterChange(event: any) {
		if (!event) return;

		const keyMapNode: Record<string, keyof NodePageableMetricRequest> = {
			region: 'region',
			streetNames: 'streetNames',
			name: 'streetNames',
			minNumberOfRides: 'numberOfRides',
			weekDay: 'weekDay',
			trafficTime: 'trafficTime',
			year: 'year'
		};
		let changed = this.applyFilter(event, keyMapNode, this.nodeFilter);
		
		
		const keyMapEdge: Record<string, keyof EdgePageableMetricRequest> = {
			region: 'region',
			streetNames: 'name',
			name: 'name',
			minNumberOfRides: 'numberOfRides',
			weekDay: 'weekDay',
			trafficTime: 'trafficTime',
			year: 'year'
		};
		changed = this.applyFilter(event, keyMapEdge, this.edgeFilter) || changed;

		if (changed) {
			this.load();
		}
	}
}
