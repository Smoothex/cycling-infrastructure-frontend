import { Component, effect, input, signal, inject, computed, model } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { Card } from 'primeng/card';
import { ChartModule } from 'primeng/chart';
import { TableModule } from 'primeng/table';
import { FeatureCollection, LineString } from 'geojson';
import { IntersectionsRequestService } from '@simra/intersections-domain';
import { EYear, ETrafficTimes, EWeekDays } from '@simra/common-models';
import {
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
	Edge
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
	protected readonly intersectionData = signal<FeatureCollection<LineString> | undefined>(undefined);
	
	protected readonly propertiesFiltered = signal<Base[]>([]);


	protected _mode = signal<ECardMode>(DATE_FILTER_DEFAULTS.mode);
    protected _selectedYear = signal<EYear>(DATE_FILTER_DEFAULTS.year);
    protected _selectedWeekDays = signal<EWeekDays>(DATE_FILTER_DEFAULTS.weekDays);
    protected _selectedTrafficTime = signal<ETrafficTimes>(DATE_FILTER_DEFAULTS.trafficTime);
    protected _startTime = signal<Date>(DATE_FILTER_DEFAULTS.startTime);
    protected _endTime = signal<Date>(DATE_FILTER_DEFAULTS.endTime);
    protected _datetime$ = signal<Date[]>(DATE_FILTER_DEFAULTS.getDatetime());

	constructor() {
		effect(async () => {
			const baseId = this.id();
			if (!baseId) return;

			const props = await this._requestService.getIntersectionBasePropertiesSingular(Number(baseId));
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
		});

		effect(async () => {
			const baseId = this.id();
			if (!baseId) return;

			const mode = this._mode();
			if (mode === "PRECOMPUTED") {
				const trafficTime = this._selectedTrafficTime();
				const weekDay = this._selectedWeekDays();
				const year = this._selectedYear();
				
				const request = {
					id: Number(baseId),
					trafficTime: trafficTime,
					weekDay: weekDay,
					year: year
				};
				this.propertiesFiltered.set(await this._requestService.getIntersectionBaseProperties(request));
				this.intersectionData.set(await this._requestService.getIntersectionBase(request));
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

				const request = {
					id: Number(baseId),
					startDate: startDate.getTime(),
					endDate: endDate.getTime()
				};
				this.propertiesFiltered.set(await this._requestService.getIntersectionBaseProperties(request));
				this.intersectionData.set(await this._requestService.getIntersectionBase(request));
			}
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
		const intersectionData = this.intersectionData();
		if (intersectionData && isNode) {
			return mapNodeToRows(intersectionData);
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
		const intersectionData = this.intersectionData();
		if (intersectionData && !isNode) {
			return mapEdgeToRows(intersectionData);
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
}
