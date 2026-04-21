import { Component, effect, input, signal, inject, computed, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TranslatePipe } from '@ngx-translate/core';
import { RouterLink, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { Card } from 'primeng/card';
import { Divider } from 'primeng/divider';
import { ChartModule } from 'primeng/chart';
import { TableModule, TableLazyLoadEvent, TableFilterEvent } from 'primeng/table';
import { FeatureCollection, LineString } from 'geojson';
import { 
	IntersectionsRequestService, 
	mapFeaturesToNodeMetricRows, 
	mapFeaturesToEdgeMetricRows,
	mapFeaturesToEdgeRows,
	mapFeaturesToNodeRows
} from '@simra/intersections-domain';
import { EYear, ETrafficTimes, EWeekDays } from '@simra/common-models';
import { 
	PageableRequest, 
	IntersectionChart, 
	DateFilter, 
	DATE_FILTER_DEFAULTS, 
	ECardMode, NodeRow, 
	EdgeRow, 
	ListColumn, 
	applyQueryParamsForLineHighlight, 
	IntersectionListContent, 
	IntersectionListHeader, 
	IntersectionMap, 
	IntersectionRow, 
	Base, 
	Node, 
	Edge, 
	BASE_CHART_CONFIG, 
	NodePageableRequestPrecomputed,
	NodePageableRequestStartEndDate, 
	EdgePageableRequestPrecomputed,
	EdgePageableRequestStartEndDate, 
	PrecomputedRequest, 
	StartEndDateRequest, 
	PagedGeoResponse, 
	onFilterChangeHelper, 
	onLazyHelper,
	NodeMetricRow, 
	EdgeMetricRow,
	IntersectionChartMetric,
	NodePageableMetricRequest,
	EdgePageableMetricRequest,
	BASE_METRIC_CHART_CONFIG,
	NODE_METRIC_CHART_CONFIG,
	BaseMetric
} from '@simra/intersections-common';
import { scrollToElementId } from '@simra/helpers';


@Component({
	selector: 'detail',
	imports: [CommonModule, FormsModule, TableModule, ButtonModule, Divider, TranslatePipe, ChartModule,
    IntersectionListContent, IntersectionListHeader, IntersectionChart, IntersectionMap, Card, RouterLink, DateFilter, IntersectionChartMetric],
	templateUrl: './detail.html',
})
export class IntersectionsDetailPage {
	private readonly _router = inject(Router);
	private readonly _requestService = inject(IntersectionsRequestService);

	protected readonly id = input.required<string>();
	protected readonly base = signal<Base | null>(null);
	protected readonly baseId = signal<number | undefined>(undefined);
	protected readonly baseIdFeature = signal<FeatureCollection<LineString> | null>(null);
	protected readonly baseIdZoom = computed(() => {
		const edgeMetric = this.metricEdge();
		if (edgeMetric) return edgeMetric.mapLinkSegment.params;
		const nodeMetric = this.metricNode();
		if (nodeMetric) return nodeMetric.mapLinkSegment.params;
		return undefined;
	});

	protected request = computed<PrecomputedRequest | StartEndDateRequest | null>(() => this.precomputedRequest() ?? this.startEndRequest());
	protected precomputedRequest = signal<PrecomputedRequest | null>(null);
	protected startEndRequest = signal<StartEndDateRequest | null>(null);
	protected nodeRequest = signal<NodePageableRequestPrecomputed | NodePageableRequestStartEndDate | null>(null);
	protected edgeRequest = signal<EdgePageableRequestPrecomputed | EdgePageableRequestStartEndDate | null>(null);
	protected pagedRequest = signal<PageableRequest>({
		page: 0,
		size: 10,
		sort: "waitingTime,DESC"
	});
	protected nodeMetricRequest = signal<NodePageableMetricRequest | null>(null);
	protected edgeMetricRequest = signal<EdgePageableMetricRequest | null>(null);
	protected readonly pagedGeoResponse = signal<PagedGeoResponse<LineString> | null>(null);
	protected readonly totalElements = computed(() => {
        const response = this.pagedGeoResponse();
        return response?.metadata?.totalElements ? response.metadata.totalElements : 0;
    });

	protected _mode = signal<ECardMode>(DATE_FILTER_DEFAULTS.mode);
    protected _selectedYear = signal<EYear>(DATE_FILTER_DEFAULTS.year);
    protected _selectedWeekDays = signal<EWeekDays>(DATE_FILTER_DEFAULTS.weekDays);
    protected _selectedTrafficTime = signal<ETrafficTimes>(DATE_FILTER_DEFAULTS.trafficTime);
    protected _startTime = signal<Date>(DATE_FILTER_DEFAULTS.startTime);
    protected _endTime = signal<Date>(DATE_FILTER_DEFAULTS.endTime);
    protected _datetime$ = signal<Date[]>(DATE_FILTER_DEFAULTS.getDatetime());

	constructor() {
		effect(async () => {
			const baseId = Number(this.id());
			if (!baseId) return;

			const data = await this._requestService.getIntersectionBasePropertiesSingular(baseId);
			const props = data ? <Base> data.features[0].properties : null;
			if (!data || !props) {
				console.error(`There is no segment with id ${baseId}`);
				return;
			}
			this.base.set(props);
			this.baseIdFeature.set(data);
			
			const node = <Node> props;
			const isNode = node.trafficSignalClusterId ? true : false;
			this.isNode.set(isNode);
			if (isNode) {
				this.firstNode.set(node);
			} else {
				const edge = <Edge> props;
				this.firstEdge.set(edge);
			}

			this.baseId.set(baseId);
		});

		effect(async () => {
			const baseId = this.baseId();
			if (!baseId) return;

			const mode = this._mode();
			if (mode === "PRECOMPUTED") {				
				this.precomputedRequest.set({
					trafficTime: this._selectedTrafficTime(),
					weekDay: this._selectedWeekDays(),
					year: this._selectedYear()
				});
			} else {
				const datetime = this._datetime$();
				if (datetime.length != 2 || !datetime[0] || !datetime[1]) return;

				const startDate = datetime[0];
				const startHourMinute = this._startTime();
				startDate.setHours(startHourMinute.getHours());
				startDate.setMinutes(startHourMinute.getMinutes());

				const endDate = datetime[1];
				const endHourMinute = this._endTime();
				endDate.setHours(endHourMinute.getHours());
				endDate.setMinutes(endHourMinute.getMinutes());

				this.startEndRequest.set({
					startDate: startDate.getTime(),
					endDate: endDate.getTime()
				});
			}
		});

		effect(async () => {
			const request = this.request();
			const node = this.firstNode();
			if (!request || !node) return;

			this.nodeRequest.set({
				...this.pagedRequest(),
				...request,
				trafficSignalClusterId: node.trafficSignalClusterId,
				startValhallaEdgeId: node.startValhallaEdgeId,
				endValhallaEdgeId: node.endValhallaEdgeId
			})
		});

		effect(async () => {
			const request = this.request();
			const edge = this.firstEdge();
			if (!request || !edge) return;
			
			this.edgeRequest.set({
				...this.pagedRequest(),
				...request,
				valhallaEdgeId: edge.valhallaEdgeId,
				prevValhallaEdgeId: edge.prevValhallaEdgeId,
				nextValhallaEdgeId: edge.nextValhallaEdgeId
			})
		});


		effect(async () => {
			const pagedRequest = this.pagedRequest();
			const nodeRequest = this.nodeRequest();
			if (!nodeRequest) return;
			this.tableDataIsLoading.set(true);
			
			const geoData = await this._requestService.getIntersectionNodes({
				...nodeRequest,
				...pagedRequest
			});
			this.pagedGeoResponse.set(geoData);
			
			this.tableDataIsLoading.set(false);
		});

		effect(async () => {
			const pagedRequest = this.pagedRequest();
			const edgeRequest = this.edgeRequest();
			if (!edgeRequest) return;
			this.tableDataIsLoading.set(true);

			const geoData = await this._requestService.getIntersectionEdges({
				...edgeRequest,
				...pagedRequest
			});
			this.pagedGeoResponse.set(geoData);

			this.tableDataIsLoading.set(false);
		});

		effect(async () => {
			const request = this.precomputedRequest();
			const node = this.firstNode();
			if (!request || !node) return;
			this.nodeMetricRequest.set({
				page: 0,
				size: 10,
				...request,
				numberOfRides: 0,
				trafficSignalClusterId: node.trafficSignalClusterId,
				startValhallaEdgeId: node.startValhallaEdgeId,
				endValhallaEdgeId: node.endValhallaEdgeId
			});
		})
		effect(async () => {
			const request = this.nodeMetricRequest();

			if (!request) return;
			const data = await this._requestService.getIntersectionNodeMetricsPageable(request);
			this.pagedGeoResponseMetric.set(data);
			if (data.geoData.features.length === 1) {
				this.metricNode.set(mapFeaturesToNodeMetricRows(data.geoData)[0]);
			}
		});

		effect(async () => {
			const request = this.precomputedRequest();
			const edge = this.firstEdge();
			if (!request || !edge) return;
			this.edgeMetricRequest.set({
				page: 0,
				size: 10,
				...request,
				numberOfRides: 0,
				valhallaEdgeId: edge.valhallaEdgeId,
				prevValhallaEdgeId: edge.prevValhallaEdgeId,
				nextValhallaEdgeId: edge.nextValhallaEdgeId
			});
		});
		effect(async () => {
			const request = this.edgeMetricRequest();
			if (!request) return;
			const data = await this._requestService.getIntersectionEdgeMetricsPageable(request);
			this.pagedGeoResponseMetric.set(data);
			if (data.geoData.features.length === 1) {
				this.metricEdge.set(mapFeaturesToEdgeMetricRows(data.geoData)[0]);
			}
		});
	}

	protected readonly trafficSignalClusterId = computed(() => {
		const firstNode = this.firstNode();
		if (firstNode) return firstNode.trafficSignalClusterId;

		const firstEdge = this.firstEdge();
		if (firstEdge) return NaN;
		
		return undefined;
	})
	protected readonly pagedGeoResponseMetric = signal<PagedGeoResponse<LineString> | null>(null);
	protected readonly isNode = signal<boolean | undefined>(undefined);

	protected readonly firstNode = signal<Node | null>(null);
	protected readonly metricNode = signal<NodeMetricRow | null>(null);

	protected readonly firstEdge = signal<Edge | null>(null);
	protected readonly metricEdge = signal<EdgeMetricRow | null>(null);

	protected readonly metricBase = computed<BaseMetric | null>(() => {
		if (this.metricNode()) {
			return this.metricNode();
		}
		return this.metricEdge();
	});
	

	protected readonly tableDataIsLoading = signal(false);
	protected readonly columns = computed<ListColumn<IntersectionRow>[]>(() => 
		this.isNode() ? this.nodeColumns as ListColumn<IntersectionRow>[] : this.edgeColumns as ListColumn<IntersectionRow>[]);

	protected readonly nodeRows = computed(() => {
		const isNode = this.isNode();
		const intersectionData = this.pagedGeoResponse();
		if (intersectionData && isNode) {
			return mapFeaturesToNodeRows(intersectionData.geoData);
		}
		return [];
	});
	protected readonly baseColumns: ListColumn<Base>[] = [
		{ field: 'startTime', header: 'Start Time', sortable: true, display: "date" },
		{ field: 'speed', header: 'INTERSECTIONS.HEADERS.SPEED', sortable: true, display: "number"  },
		{ field: 'length', header: 'INTERSECTIONS.HEADERS.LENGTH', sortable: true, display: "number" },
		{ field: 'duration', header: 'INTERSECTIONS.HEADERS.DURATION', sortable: true, display: "number"  },
		{ field: 'waitingTime', header: 'INTERSECTIONS.HEADERS.MEDIANWAITINGTIME', sortable: true, display: "number" },
	] ;
	protected readonly nodeColumns: ListColumn<NodeRow>[] = [
		{ field: 'id', header: '', sortable: false, display: "zoomOnLine" },
		{ field: 'id', header: 'INTERSECTIONS.HEADERS.SEGMENTID', sortable: false, display: "text" },
		{ field: 'nodeLink', header: 'Ride ID', sortable: false, display: "link"  },
		...this.baseColumns
	];

	protected readonly edgeRows = computed(() => {
		const isNode = this.isNode();
		const intersectionData = this.pagedGeoResponse();
		if (intersectionData && !isNode) {
			const data = mapFeaturesToEdgeRows(intersectionData.geoData);
			return data;
		}
		return [];
	});
	protected readonly edgeColumns: ListColumn<EdgeRow>[] = [
		{ field: 'id', header: '', sortable: false, display: "zoomOnLine" },
		{ field: 'id', header: 'INTERSECTIONS.HEADERS.SEGMENTID', sortable: false, display: "text" },
		{ field: 'edgeLink', header: 'Ride ID', sortable: false, display: "link"  },
		...this.baseColumns
	];

	handleZoom(row: IntersectionRow) {
		applyQueryParamsForLineHighlight(this._router, row.id, row.midPoint[1], row.midPoint[0], true, "intersectionLineData");
		scrollToElementId('intersection-map');
	}

	onFilterChange (event: TableFilterEvent) {
		onFilterChangeHelper(event, this.pagedRequest);
	}

	onLazy(event: TableLazyLoadEvent) {
		onLazyHelper(event, this.pagedRequest);
	}


	protected readonly BASE_METRIC_CHART_CONFIG = BASE_METRIC_CHART_CONFIG;
	protected readonly NODE_METRIC_CHART_CONFIG = NODE_METRIC_CHART_CONFIG;
	protected readonly config = BASE_CHART_CONFIG;
	protected loadEdges = (req: EdgePageableRequestPrecomputed | EdgePageableRequestStartEndDate, page: number, size: number) => {
		return this._requestService.getIntersectionEdgeProperties({ ...req, page, size });
	}
	protected loadNodes = (req: NodePageableRequestPrecomputed | NodePageableRequestStartEndDate, page: number, size: number) => {
		return this._requestService.getIntersectionNodeProperties({ ...req, page, size });
	}
	protected loadEdgeMetric = async (req: EdgePageableMetricRequest) => {
		const data = await this._requestService.getIntersectionEdgeMetricsPageableProperties(req);
		if (data.metadata.totalElements === 1) return data.properties[0];
		return null;
	}
	protected loadNodeMetric = async (req: NodePageableMetricRequest) => {
		const data = await this._requestService.getIntersectionNodeMetricsPageableProperties(req);
		if (data.metadata.totalElements === 1) return data.properties[0];
		return null;
	}
}
