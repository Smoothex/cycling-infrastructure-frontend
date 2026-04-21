import { Component, effect, input, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Card } from 'primeng/card';
import { Divider } from 'primeng/divider';
import { TableModule, TableLazyLoadEvent, TableFilterEvent } from 'primeng/table';
import { LineString } from 'geojson';
import { IntersectionsRequestService, mapFeaturesToNodeMetricRows, mapFeaturesToEdgeMetricRows } from '@simra/intersections-domain';
import { EYear, ETrafficTimes, EWeekDays } from '@simra/common-models';
import {
	BaseMetric,
	DateFilterPrecomputed, 
	DATE_FILTER_DEFAULTS,
	EdgeMetricRow,
	IntersectionMap, 
	IntersectionChart,
	IntersectionRow, 
	NodeMetricRow,
	ListColumn, 
	applyQueryParamsForLineHighlight, 
	Base,
	IntersectionListContent,
	IntersectionListHeader,
	onLazyHelper,
	onFilterChangeHelper,
	PagedGeoResponse,
	BASE_CHART_CONFIG,
	NodePageableRequestPrecomputed,
	NodePageableRequestStartEndDate,
	EdgePageableRequestPrecomputed,
	EdgePageableRequestStartEndDate,
	NodePageableMetricRequest,
	EdgePageableMetricRequest,
	BASE_METRIC_CHART_CONFIG,
	NODE_METRIC_CHART_CONFIG,
	PageableRequest,
	PagedProperties
} from '@simra/intersections-common';
import { scrollToElementId } from '@simra/helpers';
import { StreetsRequestService } from '@simra/streets-domain';
import { firstValueFrom } from 'rxjs';
import { IResponseStreet } from '@simra/streets-common';
import { HIGHWAY_TYPES_TO_TRANSLATION } from '@simra/streets-explorer';


@Component({
	selector: 'lib-aggregate',
	imports: [CommonModule, TableModule, ButtonModule, Card, Divider, RouterLink, TranslatePipe,
    DateFilterPrecomputed, IntersectionMap, IntersectionChart, IntersectionListContent, IntersectionListHeader],
	templateUrl: './aggregate.html',
})
export class IntersectionsAggregatePage {
	private readonly _router = inject(Router);
	private readonly _requestService = inject(IntersectionsRequestService);
	private readonly _streetRequestService = inject(StreetsRequestService);


	protected nodeRequest = signal<NodePageableRequestPrecomputed | null>(null);
	protected edgeRequest = signal<EdgePageableRequestPrecomputed | null>(null);
	protected pagedRequest = signal<PageableRequest>({
		page: 0,
		size: 20,
		sort: "numberOfRides,DESC"
	});
	protected nodeMetricRequest = computed<NodePageableMetricRequest | null>(() => {
		const request = this.nodeRequest();
		if (!request) return null;
		const metricRequest = {...request, numberOfRides: 0};
		const pagedRequest = this.pagedRequest();
		metricRequest.page = pagedRequest.page;
		metricRequest.size = pagedRequest.size;
		metricRequest.sort = pagedRequest.sort;
		return metricRequest;
	});
	protected edgeMetricRequest = computed<EdgePageableMetricRequest | null>(() => {
		const request = this.edgeRequest();
		if (!request) return null;
		const metricRequest = {...request, numberOfRides: 0};
		const pagedRequest = this.pagedRequest();
		metricRequest.page = pagedRequest.page;
		metricRequest.size = pagedRequest.size;
		metricRequest.sort = pagedRequest.sort;
		return metricRequest;
	});
	protected readonly firstBase = signal<PagedProperties<Base> | null>(null);
	
	protected readonly propertiesFiltered = signal<Base[]>([]);
	protected readonly pagedGeoResponse = signal<PagedGeoResponse<LineString> | null>(null);
	protected readonly totalElements = computed(() => {
        const response = this.pagedGeoResponse();
        return response?.metadata?.totalElements ? response.metadata.totalElements : 0;
    });
	protected readonly zoom = computed(() => {
		const edgeRows = this.edgeRows();
		if (edgeRows) {
			for (const row of edgeRows) {
				if (row.osmId === this.osmId()) {
					return row.mapLinkOsm.params;
				}
			}
		}
		const nodeRows = this.nodeRows();
		if (nodeRows && nodeRows.length > 0) return nodeRows[0].mapLinktrafficSignalCluster.params;
		return undefined;
	});

	
	protected readonly nodeId = input<string>();
	protected readonly trafficSignalClusterId = signal<number | undefined>(undefined);

	protected readonly edgeId = input<string>();
	protected readonly osmId = signal<number | undefined>(undefined);
	protected readonly osmProperties = signal<IResponseStreet | null>(null);

	protected readonly isNode = signal<Boolean>(false);

    protected _selectedYear = signal<EYear>(DATE_FILTER_DEFAULTS.year);
    protected _selectedWeekDays = signal<EWeekDays>(DATE_FILTER_DEFAULTS.weekDays);
    protected _selectedTrafficTime = signal<ETrafficTimes>(DATE_FILTER_DEFAULTS.trafficTime);


	protected readonly tableDataIsLoading = signal(false);
	protected readonly chartDataIsLoading = signal(false);

	protected readonly metricColumns : ListColumn<BaseMetric>[] = [
		{ field: 'numberOfRides', header: 'INTERSECTIONS.HEADERS.RIDES', sortable: true, display: "number" },
		{ field: 'avgSpeed', header: 'INTERSECTIONS.HEADERS.SPEED', sortable: true, display: "number" },
		{ field: 'avgLength', header: 'INTERSECTIONS.HEADERS.LENGTH', sortable: true, display: "number" },
		{ field: 'avgDuration', header: 'INTERSECTIONS.HEADERS.DURATION', sortable: true, display: "number" },
		{ field: 'avgWaitingTime', header: 'INTERSECTIONS.HEADERS.MEDIANWAITINGTIME', sortable: true, display: "number" },
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


		effect(async () => {
			const id = this.trafficSignalClusterId();
			if (!id) return;
			const nodeRequest = {
				page: 0,
				size: 20,
				trafficSignalClusterId: id,
				weekDay: this._selectedWeekDays(),
				trafficTime: this._selectedTrafficTime(),
				year: this._selectedYear()
			}
			this.nodeRequest.set(nodeRequest);
			this.firstBase.set(await this._requestService.getIntersectionNodeProperties(nodeRequest));
		});
		effect(async () => {
			const request = this.nodeMetricRequest();
			if (!request) return;
			this.tableDataIsLoading.set(true);
			const data = await this._requestService.getIntersectionNodeMetricsPageable(request);
			this.pagedGeoResponse.set(data);
			this.nodeRows.set(mapFeaturesToNodeMetricRows(data.geoData));
			this.tableDataIsLoading.set(false);
		});

		effect(async () => {
			const id = this.osmId();
			if (!id) return;
			const edgeRequest = {
				page: 0,
				size: 20,
				osmId: id,
				weekDay: this._selectedWeekDays(),
				trafficTime: this._selectedTrafficTime(),
				year: this._selectedYear()
			};
			this.edgeRequest.set(edgeRequest);
			this.firstBase.set(await this._requestService.getIntersectionNodeProperties(edgeRequest));
		});
		effect(async () => {
			const request = this.edgeMetricRequest();
			if (!request) return;
			this.tableDataIsLoading.set(true);
			const data = await this._requestService.getIntersectionEdgeMetricsPageable(request);
			this.pagedGeoResponse.set(data);
			this.edgeRows.set(mapFeaturesToEdgeMetricRows(data.geoData));
			this.tableDataIsLoading.set(false);
		});

		effect(async() => {
			const id = this.osmId();
			if (!id) return;
			this.osmProperties.set(await firstValueFrom(this._streetRequestService.getStreet(id)));
		})
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


	protected readonly BASE_METRIC_CHART_CONFIG = BASE_METRIC_CHART_CONFIG;
	protected readonly NODE_METRIC_CHART_CONFIG = NODE_METRIC_CHART_CONFIG;
	protected readonly BASE_CHART_CONFIG = BASE_CHART_CONFIG;
	protected readonly HIGHWAY_TYPES_TO_TRANSLATION = HIGHWAY_TYPES_TO_TRANSLATION;
	protected loadEdges = (req: EdgePageableRequestPrecomputed | EdgePageableRequestStartEndDate, page: number, size: number) => {
		return this._requestService.getIntersectionEdgeProperties({ ...req, page, size });
	};
	protected loadNodes = (req: NodePageableRequestPrecomputed | NodePageableRequestStartEndDate, page: number, size: number) => {
		return this._requestService.getIntersectionNodeProperties({ ...req, page, size });
	};
	protected loadEdgeMetric = (req: EdgePageableMetricRequest, page: number, size: number) => {
		return this._requestService.getIntersectionEdgeMetricsPageableProperties({ ...req, page, size });
	};
	protected loadNodeMetric = (req: NodePageableMetricRequest, page: number, size: number) => {
		return this._requestService.getIntersectionNodeMetricsPageableProperties({ ...req, page, size });
	};
}
