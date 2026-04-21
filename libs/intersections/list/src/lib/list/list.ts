import { Component, inject, signal, effect, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IntersectionsRequestService } from '@simra/intersections-domain';
import { RegionRequestService } from '@simra/streets-domain';
import {
	NodePageableMetricRequest, 
	NodeMetricRow,
	EdgePageableMetricRequest,
	EdgeMetricRow,
	ListColumn,
	IntersectionRow,
	IntersectionListContent,
	IntersectionListHeader,
	IntersectionListHeaderFilter,
	BaseMetric,
	onLazyHelper,
	onFilterChangeHelper,
	PagedProperties
} from '@simra/intersections-common';
import { TranslatePipe } from '@ngx-translate/core';
import {
	AutocompleteComponent,
	TRAFFIC_TIMES_TO_TRANSLATION,
	WEEK_DAYS_TO_TRANSLATION, YEAR_TO_TRANSLATION
} from '@simra/common-components';
import { Observable } from 'rxjs';
import { Card } from 'primeng/card';
import { TableLazyLoadEvent, TableModule, TableFilterEvent } from 'primeng/table';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { ETrafficTimes, EWeekDays, EYear } from '@simra/common-models';

@Component({
	selector: 'lib-list',
	standalone: true,
	imports: [
		CommonModule, FormsModule, Card, TableModule, ToggleButtonModule, TranslatePipe, 
		AutocompleteComponent, IntersectionListContent, IntersectionListHeader, IntersectionListHeaderFilter],
	templateUrl: './list.html',
	styleUrl: './list.scss',
})
export class IntersectionsList {
	private readonly _requestService = inject(IntersectionsRequestService);
	private readonly _regionRequestService = inject(RegionRequestService);

	private readonly defaults = {
		trafficSignalClusterId: undefined,
		numberOfRides: 50,
		region: undefined,
		streetNames: undefined,
		name: undefined,
		weekDay: EWeekDays.ALL_WEEK,
		trafficTime: ETrafficTimes.ALL_DAY,
		year: EYear.ALL,
		page: 0,
		size: 20,
		sort: "avgWaitingTime,DESC"
	}

	protected readonly pagedProperties = signal<PagedProperties<BaseMetric> | null>(null);
	protected readonly totalElements = computed(() => {
        const response = this.pagedProperties();
        return response?.metadata?.totalElements ? response.metadata.totalElements : 0;
    });

	protected readonly metricColumns : ListColumn<BaseMetric>[] = [
		{ 
			field: 'numberOfRides', 
			header: 'INTERSECTIONS.HEADERS.RIDES', 
			sortable: true, 
			display: "number",
			headerFilter: { step: 5, min: 0, default: this.defaults.numberOfRides },
			tooltip: 'INTERSECTIONS.TIP.RIDES'
		},
		{ 
			field: 'avgSpeed', 
			header: 'INTERSECTIONS.HEADERS.SPEED',
			sortable: true, 
			display: "number",
			tooltip: 'INTERSECTIONS.TIP.SPEED'
		},
		{ 
			field: 'avgLength', 
			header: 'INTERSECTIONS.HEADERS.LENGTH',
			sortable: true,
			display: "number",
			tooltip: 'INTERSECTIONS.TIP.LENGTH'
		},
		{ 
			field: 'avgDuration',
			header: 'INTERSECTIONS.HEADERS.DURATION',
			sortable: true, 
			display: "number",
			tooltip: 'INTERSECTIONS.TIP.DURATION'
		},
		{ 
			field: 'avgWaitingTime',
			header: 'INTERSECTIONS.HEADERS.MEDIANWAITINGTIME',
			sortable: true, 
			display: "number",
			tooltip: 'INTERSECTIONS.TIP.MEDIANWAITINGTIME'
		},
		{
			field: 'sumWaitingTime',
			header: 'INTERSECTIONS.HEADERS.SUMWAITINGTIME',
			sortable: true,
			display: "number",
		},
		{
			field: 'weekDay', 
			header: 'INTERSECTIONS.HEADERS.WEEKDAY',
			sortable: false,
			display: "enum",
			translationMap: WEEK_DAYS_TO_TRANSLATION, 
			headerFilter: { enum: EWeekDays, default: this.defaults.weekDay }
		},
		{ 
			field: 'trafficTime',
			header: 'INTERSECTIONS.HEADERS.TRAFFICTIME', 
			sortable: false,
			display: "enum", 
			translationMap: TRAFFIC_TIMES_TO_TRANSLATION,
			headerFilter: { enum: ETrafficTimes, default: this.defaults.trafficTime }
		},
		{ 
			field: 'year', 
			header: 'INTERSECTIONS.HEADERS.YEAR',
			sortable: false,
			display: "enum", 
			translationMap: YEAR_TO_TRANSLATION, 
			headerFilter: { enum: EYear, default: this.defaults.year}
		}
	]
	
	protected readonly nodeColumns: ListColumn<NodeMetricRow>[] = [
		{ 
			field: 'trafficSignalClusterLink', 
			header: 'INTERSECTIONS.HEADERS.INTERSECTIONID', 
			sortable: false, 
			display: "link",
			tooltip: 'INTERSECTIONS.TIP.INTERSECTIONID'
		},
		{ 
			field: 'segmentLink', 
			header: 'INTERSECTIONS.HEADERS.SEGMENTID', 
			display: "link",
			sortable: false,
			tooltip: 'INTERSECTIONS.TIP.SEGMENTID'
		},
		{ 
			field: 'streetNames', 
			header: 'Name', 
			sortable: true, 
			display: "autocomplete",
			tooltip: 'INTERSECTIONS.TIP.STREETNAMES',
			headerFilter: {
				fetchFunction: (query: string): Observable<string[]> => {
					const nodeFilter = this.nodeFilter();
					nodeFilter.streetNames = query;
					return this._requestService.getIntersectionNodeStreetNames(nodeFilter);
				}
			}
		},
		...this.metricColumns
	];
	protected nodeFilter = signal<NodePageableMetricRequest>({
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
	});

	protected readonly edgeColumns: ListColumn<EdgeMetricRow>[] = [
		{ 
			field: 'osmLink', 
			header: 'INTERSECTIONS.HEADERS.OSMID',
			sortable: false,
			display: "link",
			tooltip: 'INTERSECTIONS.TIP.OSMID'
		},
		{ 
			field: 'segmentLink',
			header: 'INTERSECTIONS.HEADERS.SEGMENTID',
			sortable: false,
			display: "link",
			tooltip: 'INTERSECTIONS.SEGMENTID.OSMID'
		},
		{ 
			field: 'name',
			header: 'Name',
			sortable: true,
			display: "autocomplete",
			tooltip: 'INTERSECTIONS.SEGMENTID.NAME',
			headerFilter: {
				fetchFunction: (query: string): Observable<string[]> => {
					const edgeFilter = this.edgeFilter();
					edgeFilter.name = query;
					return this._requestService.getIntersectionEdgeStreetNames(edgeFilter);
				}
			}
		},
		...this.metricColumns
	];
	protected edgeFilter = signal<EdgePageableMetricRequest>({
		numberOfRides: this.defaults.numberOfRides,
		region: this.defaults.region,
		name: this.defaults.name,
		weekDay: this.defaults.weekDay,
		trafficTime: this.defaults.trafficTime,
		year: this.defaults.year,
		page: this.defaults.page,
		size: this.defaults.size,
		sort: this.defaults.sort
	});


	protected readonly loading = signal(false);
	protected readonly rows = signal<NodeMetricRow[] | EdgeMetricRow[]>([]);
	protected readonly requestFilter = computed(() => this.isNode() ? this.nodeFilter() : this.edgeFilter());
	protected columns = computed(() => (this.isNode() ? this.nodeColumns : this.edgeColumns) as ListColumn<IntersectionRow>[]);
	protected isNode = signal<boolean>(true);
	

	public fetchRegionNames = (query: string): Observable<string[]> => {
		return this._regionRequestService.fetchRegionNames(query);
	};

	constructor () {
		effect(async () => {
			const isNode = this.isNode();
			const request = isNode ? this.nodeFilter() : this.edgeFilter();
			this.loading.set(true);
			const data = isNode ? await this._requestService.getIntersectionNodeMetricsPageableProperties(request) 
				: await this._requestService.getIntersectionEdgeMetricsPageableProperties(request);
			this.pagedProperties.set(data);
			this.rows.set(data.properties);
			this.loading.set(false);
		});
	}

	onFilterChange (event: TableFilterEvent) {
		onFilterChangeHelper(event, this.nodeFilter);
		onFilterChangeHelper(event, this.edgeFilter);
	}

	onLazy(event: TableLazyLoadEvent) { 
		onLazyHelper(event, this.nodeFilter);
		onLazyHelper(event, this.edgeFilter);
	}
}
