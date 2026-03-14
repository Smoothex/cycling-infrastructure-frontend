import { Component, effect, input, inject, signal, computed, WritableSignal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Card } from 'primeng/card';
import { TableModule, TableFilterEvent, TableLazyLoadEvent } from 'primeng/table';
import { FeatureCollection, LineString } from 'geojson';
import { IntersectionsRequestService } from '@simra/intersections-domain';
import { EYear, ETrafficTimes, EWeekDays,  } from '@simra/common-models';
import {
	BaseMetric,
	DateFilterPrecomputed, 
	DATE_FILTER_DEFAULTS,
	EdgeMetricRow,
	IntersectionMap, 
	IntersectionChart,
	mapEdgeMetricToRows, 
	IntersectionRow, 
	NodeMetricRow, 
	mapNodeMetricToRows, 
	ListColumn, 
	applyQueryParamsForLineHighlight, 
	Base, 
	NodePageableMetricRequest, 
	EdgePageableMetricRequest,
	IntersectionListContent,
	IntersectionListHeader,
	onLazyHelper,
	onFilterChangeHelper,
	PageableMetricRequest,
	PagedGeoResponse,
	BASE_CHART_CONFIG
} from '@simra/intersections-common';
import { scrollToElementId } from '@simra/helpers';


@Component({
	selector: 'lib-aggregate',
	imports: [CommonModule, TableModule, Card, DateFilterPrecomputed,
		IntersectionMap, IntersectionChart, IntersectionListContent, IntersectionListHeader],
	templateUrl: './aggregate.html',
})
export class IntersectionsAggregatePage {
	private readonly _router = inject(Router);
	private readonly _RequestService = inject(IntersectionsRequestService);

	protected nodeRequest = signal<NodePageableMetricRequest | null>(null);
	protected edgeRequest = signal<EdgePageableMetricRequest | null>(null);
	protected pagedRequest = signal<PageableMetricRequest>({
		numberOfRides: 0,
		page: 0,
		size: 20,
		sort: "medianWaitingTime,DESC"
	});
	
	protected readonly propertiesFiltered = signal<Base[]>([]);
	protected readonly pagedGeoResponse = signal<PagedGeoResponse<LineString> | null>(null);
	protected readonly totalElements = computed(() => {
        const response = this.pagedGeoResponse();
        return response?.metadata?.totalElements ? response.metadata.totalElements : 0;
    });
	
	protected readonly nodeId = input<string>();
	protected trafficSignalClusterId = signal<number | undefined>(undefined);

	protected readonly edgeId = input<string>();
	protected osmId = signal<number | undefined>(undefined);

	

	protected readonly isNode = signal<Boolean>(false);
	protected readonly header = computed(() => this.isNode() ? `Intersection ${this.trafficSignalClusterId()}` : `Way ${this.osmId()}`)

    protected _selectedYear = signal<EYear>(DATE_FILTER_DEFAULTS.year);
    protected _selectedWeekDays = signal<EWeekDays>(DATE_FILTER_DEFAULTS.weekDays);
    protected _selectedTrafficTime = signal<ETrafficTimes>(DATE_FILTER_DEFAULTS.trafficTime);


	protected readonly tableDataIsLoading = signal(false);
	protected readonly chartDataIsLoading = signal(false);

	protected readonly metricColumns : ListColumn<BaseMetric>[] = [
		{ field: 'numberOfRides', header: 'INTERSECTIONS.HEADERS.RIDES', sortable: true, display: "number" },
		{ field: 'medianSpeed', header: 'INTERSECTIONS.HEADERS.SPEED', sortable: true, display: "number" },
		{ field: 'medianLength', header: 'INTERSECTIONS.HEADERS.LENGTH', sortable: true, display: "number" },
		{ field: 'medianDuration', header: 'INTERSECTIONS.HEADERS.DURATION', sortable: true, display: "number" },
		{ field: 'medianWaitingTime', header: 'INTERSECTIONS.HEADERS.MEDIANWAITINGTIME', sortable: true, display: "number" },
		{ field: 'maxWaitingTime', header: 'INTERSECTIONS.HEADERS.MAXWAITINGTIME', sortable: true, display: "number" }
	]

	protected readonly nodeRows = signal<NodeMetricRow[]>([]);
	protected readonly nodeColumns: ListColumn<NodeMetricRow>[] = [
		{ field: 'id', header: '', sortable: false, display: "zoomOnLine" },
		{ field: 'segmentLink', header:'INTERSECTIONS.HEADERS.SEGMENTID', sortable: false, display: "link" },
		{ field: 'streetNames', header: 'Name', sortable: true, display: "text" },
		...this.metricColumns
	];

	protected readonly edgeRows = signal<EdgeMetricRow[]>([]);
	protected readonly edgeColumns: ListColumn<EdgeMetricRow>[] = [
		{ field: 'id', header: '', sortable: false, display: "zoomOnLine" },
		{ field: 'segmentLink', header:'INTERSECTIONS.HEADERS.SEGMENTID', sortable: false, display: "link" },
		{ field: 'name', header: 'Name', sortable: true, display: "text" },
		...this.metricColumns
	];

	protected readonly columns = computed<ListColumn<IntersectionRow>[]>(() => 
		this.isNode() ? this.nodeColumns as ListColumn<IntersectionRow>[] : this.edgeColumns as ListColumn<IntersectionRow>[]);

	constructor() {
		effect(() => {
			const osmIdString = this.edgeId();
			const trafficSignalClusterIdString = this.nodeId();
			if (!osmIdString && !trafficSignalClusterIdString) return;
			this.osmId.set(osmIdString ? Number(osmIdString) : NaN);
			this.trafficSignalClusterId.set(trafficSignalClusterIdString ? Number(trafficSignalClusterIdString) : NaN);
			this.isNode.set(trafficSignalClusterIdString ? true : false);
		});


		effect(() => {
			const id = this.trafficSignalClusterId();
			if (!id) return;

			this.nodeRequest.set({
				numberOfRides: 0,
				trafficSignalClusterId: id,
				weekDay: this._selectedWeekDays(),
				trafficTime: this._selectedTrafficTime(),
				year: this._selectedYear()
			});
		});
		effect(async () => {
			const pagedRequest = this.pagedRequest();
			const nodeRequest = this.nodeRequest();
			if (!nodeRequest) return;
			this.tableDataIsLoading.set(true);
			const data = await this._RequestService.getIntersectionNodeMetricsPageable({
				...pagedRequest,
				...nodeRequest
			});
			this.pagedGeoResponse.set(data);
			this.nodeRows.set(mapNodeMetricToRows(data.geoData));
			this.tableDataIsLoading.set(false);
		});
		effect(async () => {
			const request = this.nodeRequest();
			if (!request) return;
			this.chartDataIsLoading.set(true);
			this.propertiesFiltered.set(await this._RequestService.getIntersectionNodePropertiesByTrafficSignalClusterId(request));
			this.chartDataIsLoading.set(false);
		});

		effect(() => {
			const id = this.osmId();
			if (!id) return;

			this.edgeRequest.set({
				numberOfRides: 0,
				osmId: id,
				weekDay: this._selectedWeekDays(),
				trafficTime: this._selectedTrafficTime(),
				year: this._selectedYear()
			});
		});
		effect(async () => {
			const request = this.edgeRequest();
			if (!request) return;
			this.chartDataIsLoading.set(true);
			this.propertiesFiltered.set(await this._RequestService.getIntersectionEdgePropertiesByOsmId(request));
			this.chartDataIsLoading.set(false);
		});
		effect(async () => {
			const pagedRequest = this.pagedRequest();
			const edgeRequest = this.edgeRequest();
			if (!edgeRequest) return;
			this.tableDataIsLoading.set(true);
			const data = await this._RequestService.getIntersectionEdgeMetricsPageable({
				...pagedRequest,
				...edgeRequest
			});
			this.pagedGeoResponse.set(data);
			this.edgeRows.set(mapEdgeMetricToRows(data.geoData));
			this.tableDataIsLoading.set(false);
		});
	}

	onFilterChange (event: TableFilterEvent) {
		onFilterChangeHelper(event, this.pagedRequest);
	}

	onLazy(event: TableLazyLoadEvent) {
		onLazyHelper(event, this.pagedRequest);
	}

	handleZoom(row: IntersectionRow) {
		applyQueryParamsForLineHighlight(this._router, row.id, row.midPoint[1], row.midPoint[0], true, "intersectionLineData");
		scrollToElementId('intersection-map');
	}

	protected readonly config = BASE_CHART_CONFIG;
}
