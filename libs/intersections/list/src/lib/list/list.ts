import { Component, inject, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { debounce } from 'lodash';
import { 
	IntersectionsEdgeRequestService,
	IntersectionsNodeRequestService,
	IntersectionRegionTreeComponent
} from '@simra/intersections-domain';
import {
	NodePageableMetricRequest,
	NodeMetricRow,
	EdgePageableMetricRequest,
	EdgeMetricRow,
	ListColumn,
	IntersectionRow,
	IntersectionListContentComponent,
	IntersectionListHeaderComponent,
	IntersectionListHeaderFilterComponent,
	BaseMetric,
	onLazyHelper,
	onFilterChangeHelper,
	PagedProperties,
	RouteParamUtilityService
} from '@simra/intersections-common';
import {
	TRAFFIC_TIMES_TO_TRANSLATION,
	WEEK_DAYS_TO_TRANSLATION, YEAR_TO_TRANSLATION
} from '@simra/common-components';
import { Observable } from 'rxjs';
import { Card } from 'primeng/card';
import { TableLazyLoadEvent, TableModule, TableFilterEvent } from 'primeng/table';
import { ToggleButton } from 'primeng/togglebutton';
import { ETrafficTimes, EWeekDays, EYear } from '@simra/common-models';

@Component({
	selector: 'intersection-list',
	standalone: true,
	imports: [
    FormsModule,
    Card,
    TableModule,
    ToggleButton,
    IntersectionListContentComponent,
    IntersectionListHeaderComponent,
    IntersectionListHeaderFilterComponent,
	IntersectionRegionTreeComponent
],
	templateUrl: './list.html',
})
export class IntersectionsListComponent {
	private readonly _edgeRequestService = inject(IntersectionsEdgeRequestService);
	private readonly _nodeRequestService = inject(IntersectionsNodeRequestService);
	private readonly _routeService = inject(RouteParamUtilityService);

	isTreeLoaded = false;
	protected readonly initialValues = {
		regionLTreePath: this._routeService.getInitialParam('regionLTreePath', "r_62422"),
		name: this._routeService.getInitialParam('name', undefined),
		streetNames: this._routeService.getInitialParam('streetNames', undefined),
		numberOfRides: this._routeService.getInitialParam('numberOfRides', 50, Number),
		weekDay: this._routeService.getInitialParam('weekDay', EWeekDays.ALL_WEEK),
		trafficTime: this._routeService.getInitialParam('trafficTime', ETrafficTimes.ALL_DAY),
		year: this._routeService.getInitialParam('year', EYear.ALL),
		page: this._routeService.getInitialParam('page', 0, Number),
		size: this._routeService.getInitialParam('size', 20, Number),
		sort: this._routeService.getInitialParam('sort', "avgWaitingTime,DESC")
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
			headerFilter: { step: 5, min: 0, default: this.initialValues.numberOfRides },
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
			headerFilter: { enum: EYear, default: this.initialValues.year}
		}
	];
	
	protected nodeFilter = signal<NodePageableMetricRequest>({
		regionLTreePath: this.initialValues.regionLTreePath,
		streetNames: this.initialValues.streetNames,
		numberOfRides: this.initialValues.numberOfRides,
		weekDay:  this.initialValues.weekDay,
		trafficTime: this.initialValues.trafficTime,
		year: this.initialValues.year,
		page: this.initialValues.page,
		size: this.initialValues.size,
		sort: this.initialValues.sort
	});
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
				default: this.initialValues.streetNames,
				fetchFunction: (query: string): Observable<string[]> => {
					const nodeFilter = this.nodeFilter();
					this.nodeFilter.update(f => ({ ...f, streetNames: query }));
					return this._nodeRequestService.getIntersectionNodeStreetNames(nodeFilter);
				}
			}
		},
		...this.metricColumns
	];

	protected edgeFilter = signal<EdgePageableMetricRequest>({
		regionLTreePath: this.initialValues.regionLTreePath,
		name: this.initialValues.name,
		numberOfRides: this.initialValues.numberOfRides,
		weekDay:  this.initialValues.weekDay,
		trafficTime: this.initialValues.trafficTime,
		year: this.initialValues.year,
		page: this.initialValues.page,
		size: this.initialValues.size,
		sort: this.initialValues.sort
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
				default: this.initialValues.name,
				fetchFunction: (query: string): Observable<string[]> => {
					const edgeFilter = this.edgeFilter();
					this.edgeFilter.update(f => ({ ...f, name: query }));
					return this._edgeRequestService.getIntersectionEdgeStreetNames(edgeFilter);
				}
			}
		},
		...this.metricColumns
	];

	protected readonly loading = signal(false);
	protected readonly rows = signal<NodeMetricRow[] | EdgeMetricRow[]>([]);
	protected readonly activeFilter = computed(() => this.isNode() ? this.nodeFilter() : this.edgeFilter());
	protected readonly applyQueryObject = computed(() => { return { ...this.activeFilter(), isNode: this.isNode() }});
	protected columns = computed(() => (this.isNode() ? this.nodeColumns : this.edgeColumns) as ListColumn<IntersectionRow>[]);
	protected isNode = signal<boolean>(this._routeService.getInitialParam('isNode', true, (v) => v === 'true'));


	onFilterChange (event: TableFilterEvent) {
		if (!this.isTreeLoaded) return;
		onFilterChangeHelper(event, this.nodeFilter);
		onFilterChangeHelper(event, this.edgeFilter);
		this.updateData();
	}

	onLazy(event: TableLazyLoadEvent) {
		if (!this.isTreeLoaded) return;
		onLazyHelper(event, this.nodeFilter);
		onLazyHelper(event, this.edgeFilter);
		this.updateData();
	}

	onRegionChange (selectedRegionLTreePath: string | null) {
		if (!selectedRegionLTreePath) return;
		this.isTreeLoaded = true;

		this.nodeFilter.update(f => ({ ...f, regionLTreePath: selectedRegionLTreePath }));
		this.edgeFilter.update(f => ({ ...f, regionLTreePath: selectedRegionLTreePath }));
		this.updateData();
	}

	async executeUpdateData () {
		const isNode = this.isNode();
		const request = isNode ? this.nodeFilter() : this.edgeFilter()
		this.loading.set(true);
		const data = isNode ? await this._nodeRequestService.getIntersectionNodeMetricsPageableProperties(request) 
			: await this._edgeRequestService.getIntersectionEdgeMetricsPageableProperties(request);
		this.pagedProperties.set(data);
		this.rows.set(data.properties);
		this.loading.set(false);
	}

	public updateData = debounce(() => {
		this.executeUpdateData();
	}, 500);

	constructor() {
		effect(() => {
			this._routeService.applyParams(this.applyQueryObject());
        });
	}
}
