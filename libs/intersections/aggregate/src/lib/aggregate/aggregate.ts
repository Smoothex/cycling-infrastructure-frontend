import { Component, effect, input, inject, signal, computed } from '@angular/core';

import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Card } from 'primeng/card';
import { Divider } from 'primeng/divider';
import { TableModule, TableLazyLoadEvent, TableFilterEvent } from 'primeng/table';
import { LineString } from 'geojson';
import { IntersectionsEdgeRequestService, IntersectionsNodeRequestService } from '@simra/intersections-domain';
import { EYear, ETrafficTimes, EWeekDays } from '@simra/common-models';
import {
	BaseMetric,
	DateFilterPrecomputedComponent, 
	DATE_FILTER_DEFAULTS,
	EdgeMetricRow,
	IntersectionChartComponent,
	IntersectionRow, 
	NodeMetricRow,
	ListColumn, 
	applyQueryParamsForLineHighlight, 
	Base,
	IntersectionListContentComponent,
	IntersectionListHeaderComponent,
	onLazyHelper,
	onFilterChangeHelper,
	PagedGeoResponse,
	BASE_CHART_CONFIG,
	NodePageableRequest,
	EdgePageableRequest,
	NodePageableMetricRequest,
	EdgePageableMetricRequest,
	BASE_METRIC_CHART_CONFIG,
	NODE_METRIC_CHART_CONFIG,
	PageableRequest,
	PagedProperties,
	mapFeaturesToNodeMetricRows,
	mapFeaturesToEdgeMetricRows,
	EdgeMetricRequest,
	NodeMetricRequest,
	EdgeRequest,
	NodeRequest
} from '@simra/intersections-common';
import { BaseIntersectionMapComponent } from '@simra/intersections-map';
import { scrollToElementId } from '@simra/helpers';
import { StreetsRequestService } from '@simra/streets-domain';
import { firstValueFrom } from 'rxjs';
import { IResponseStreet } from '@simra/streets-common';
import { HIGHWAY_TYPES_TO_TRANSLATION } from '@simra/streets-explorer';


@Component({
	selector: 'intersection-aggregate',
	imports: [TableModule, ButtonModule, Card, Divider, RouterLink, TranslatePipe, DateFilterPrecomputedComponent, BaseIntersectionMapComponent, IntersectionChartComponent, IntersectionListContentComponent, IntersectionListHeaderComponent],
	templateUrl: './aggregate.html',
})
export class IntersectionsAggregatePageComponent {
	private readonly _router = inject(Router);
	private readonly _edgeRequestService = inject(IntersectionsEdgeRequestService);
	private readonly _nodeRequestService = inject(IntersectionsNodeRequestService);
	private readonly _streetRequestService = inject(StreetsRequestService);


	protected nodeRequest = signal<NodePageableRequest | null>(null);
	protected edgeRequest = signal<EdgePageableRequest | null>(null);
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

	protected readonly isNode = signal<boolean>(false);

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
			this.firstBase.set(await this._nodeRequestService.getIntersectionNodeProperties(nodeRequest));
		});
		effect(async () => {
			const request = this.nodeMetricRequest();
			if (!request) return;
			this.tableDataIsLoading.set(true);
			const data = await this._nodeRequestService.getIntersectionNodeMetricsPageable(request);
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
			this.firstBase.set(await this._nodeRequestService.getIntersectionNodeProperties(edgeRequest));
		});
		effect(async () => {
			const request = this.edgeMetricRequest();
			if (!request) return;
			this.tableDataIsLoading.set(true);
			const data = await this._edgeRequestService.getIntersectionEdgeMetricsPageable(request);
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
	
	protected loadEdgeMetric = (req: EdgeMetricRequest, lastId: number | undefined, pageSize: number) => {
		return this._edgeRequestService.getIntersectionEdgeMetricsPropertiesScroll({ ...req, lastId, pageSize });
	};
	protected loadEdgeMetricCount = (req: EdgeMetricRequest) => {
		return this._edgeRequestService.getIntersectionEdgeMetricsPropertiesCount({ ...req });
	};
	
	protected loadNodeMetric = (req: NodeMetricRequest, lastId: number | undefined, pageSize: number) => {
		return this._nodeRequestService.getIntersectionNodeMetricsPropertiesScroll({ ...req, lastId, pageSize });
	};
	protected loadNodeMetricCount = (req: NodeMetricRequest) => {
		return this._nodeRequestService.getIntersectionNodeMetricsPropertiesCount({ ...req });
	};

	protected loadEdges = (req: EdgeRequest, lastId: number | undefined, pageSize: number) => {
		return this._edgeRequestService.getIntersectionEdgePropertiesScroll({ ...req, lastId, pageSize });
	};
	protected loadEdgesCount = (req: EdgeRequest) => {
		return this._edgeRequestService.getIntersectionEdgePropertiesCount({ ...req });
	};

	protected loadNodes = (req: NodeRequest, lastId: number | undefined, pageSize: number) => {
		return this._nodeRequestService.getIntersectionNodePropertiesScroll({ ...req, lastId, pageSize });
	};
	protected loadNodesCount = (req: NodeRequest) => {
		return this._nodeRequestService.getIntersectionNodePropertiesCount({ ...req });
	};
}
