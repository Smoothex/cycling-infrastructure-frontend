import { Component, effect, input, signal, inject, computed, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { Card } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { TableModule, TableLazyLoadEvent, TableFilterEvent } from 'primeng/table';
import { FeatureCollection, LineString } from 'geojson';
import { IntersectionsRequestService } from '@simra/intersections-domain';
import { EYear, ETrafficTimes, EWeekDays } from '@simra/common-models';
import {
	PageableRequest,
	IntersectionChart,
	DateFilter,
	DATE_FILTER_DEFAULTS,
	ECardMode,
	NodeRow,
	mapNodeToRows,
	EdgeRow,
	mapEdgeToRows,
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
	NodePageableRequest,
	EdgePageableRequest,
	PrecomputedRequest,
	StartEndDateRequest,
	PagedGeoResponse,
	onFilterChangeHelper,
	onLazyHelper
} from '@simra/intersections-common';
import { scrollToElementId } from '@simra/helpers';

@Component({
	selector: 'detail',
	imports: [CommonModule, FormsModule, TableModule, IntersectionListContent, IntersectionListHeader, IntersectionChart, IntersectionMap, Card, ChartModule, RouterLink, DateFilter],
	templateUrl: './detail.html',
})
export class IntersectionsDetailPage {
	private readonly _router = inject(Router);
	private readonly _requestService = inject(IntersectionsRequestService);

	protected readonly id = input.required<string>();
	protected readonly baseId = signal<number | undefined>(undefined);

	protected request = signal<PrecomputedRequest | StartEndDateRequest | null>(null);
	protected nodeRequest = signal<NodePageableRequest | null>(null);
	protected edgeRequest = signal<EdgePageableRequest | null>(null);
	protected pagedRequest = signal<PageableRequest>({
		page: 0,
		size: 10,
		sort: "waitingTime,DESC"
	});
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

			const props = await this._requestService.getIntersectionBasePropertiesSingular(baseId);
			if (!props) {
				console.error(`There is no segment with id ${baseId}`);
				return;
			}
			
			const node = <Node> props;
			const isNode = node.trafficSignalClusterId ? true : false;
			this.isNode.set(isNode);
			this.trafficSignalClusterId.set(isNode ? node.trafficSignalClusterId : NaN);
			if (isNode) {
				this.firstNode.set(node);
				this.startOsmId.set(node.startOsmId);
				this.endOsmId.set(node.endOsmId);
			} else {
				const edge = <Edge> props;
				this.firstEdge.set(edge);
				this.prevOsmId.set(edge.prevOsmId);
				this.osmId.set(edge.osmId);
				this.nextOsmId.set(edge.nextOsmId);
			}

			this.baseId.set(baseId);
		});

		effect(async () => {
			const baseId = this.baseId();
			if (!baseId) return;

			const mode = this._mode();
			if (mode === "PRECOMPUTED") {				
				this.request.set({
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

				this.request.set({
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
	}

	protected readonly firstNode = signal<Node | null>(null);
	protected readonly firstEdge = signal<Edge | null>(null);
	protected readonly isNode = signal<boolean | undefined>(undefined);

	protected readonly tableDataIsLoading = signal(false);
	protected readonly columns = computed<ListColumn<IntersectionRow>[]>(() => 
		this.isNode() ? this.nodeColumns as ListColumn<IntersectionRow>[] : this.edgeColumns as ListColumn<IntersectionRow>[]);

	// Node
	protected readonly trafficSignalClusterId = signal<number | undefined>(undefined);
	protected readonly startOsmId = signal<number | undefined>(undefined);
	protected readonly endOsmId = signal<number | undefined>(undefined);

	protected readonly nodeRows = computed(() => {
		const isNode = this.isNode();
		const intersectionData = this.pagedGeoResponse();
		if (intersectionData && isNode) {
			return mapNodeToRows(intersectionData.geoData);
		}
		return [];
	});
	protected readonly baseColumns: ListColumn<Base>[] = [
		{ field: 'rideId', header: 'Ride ID', sortable: false, display: "text",  },
		{ field: 'startTime', header: 'Start Time', sortable: true, display: "date" },
		{ field: 'speed', header: 'INTERSECTIONS.HEADERS.SPEED', sortable: true, display: "number"  },
		{ field: 'length', header: 'INTERSECTIONS.HEADERS.LENGTH', sortable: true, display: "number" },
		{ field: 'duration', header: 'INTERSECTIONS.HEADERS.DURATION', sortable: true, display: "number"  },
		{ field: 'waitingTime', header: 'INTERSECTIONS.HEADERS.MEDIANWAITINGTIME', sortable: true, display: "number" },
	] ;
	protected readonly nodeColumns: ListColumn<NodeRow>[] = [
		{ field: 'id', header: '', sortable: false, display: "zoomOnLine" },
		{ field: 'id', header: 'INTERSECTIONS.HEADERS.SEGMENTID', sortable: false, display: "text" },
		{ field: 'streetNames', header: 'Name', sortable: true, display: "text" },
		...this.baseColumns
	];

	// Edge
	protected readonly prevOsmId = signal<number | undefined>(undefined);
	protected readonly osmId = signal<number | undefined>(undefined);
	protected readonly nextOsmId = signal<number | undefined>(undefined);

	protected readonly edgeRows = computed(() => {
		const isNode = this.isNode();
		const intersectionData = this.pagedGeoResponse();
		if (intersectionData && !isNode) {
			return mapEdgeToRows(intersectionData.geoData);
		}
		return [];
	});
	protected readonly edgeColumns: ListColumn<EdgeRow>[] = [
		{ field: 'id', header: '', sortable: false, display: "zoomOnLine" },
		{ field: 'id', header: 'INTERSECTIONS.HEADERS.SEGMENTID', sortable: false, display: "text" },
		{ field: 'name', header: 'Name', sortable: true, display: "text" },
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

	protected readonly config = BASE_CHART_CONFIG;
	protected loadEdges = (req: EdgePageableRequest, page: number, size: number) => {
		return this._requestService.getIntersectionEdgeProperties({ ...req, page, size });
	}
	protected loadNodes = (req: NodePageableRequest, page: number, size: number) => {
		return this._requestService.getIntersectionNodeProperties({ ...req, page, size });
	}
}
