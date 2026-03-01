import { Component, effect, input, Input, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { Feature, FeatureCollection, GeoJsonProperties, LineString, Point, Polygon } from 'geojson';
import { IntersectionsRequestService } from '@simra/intersections-domain';
import { ChartDetail } from '../../components/chart/chart-detail';
import { EYear, ETrafficTimes, EWeekDays } from '@simra/common-models';
import {
	DateFilter,
	DATE_FILTER_DEFAULTS,
	ECardMode,
	NodeRow,
	mapNodeToRows,
	EdgeRow,
	mapEdgeToRows,
	ListColumn,
	applyQueryParamsForLineHighlight,
	IntersectionList,
	IntersectionMap,
	IntersectionRow,
	MetricRequest
} from '@simra/intersections-common';
import { scrollToElementId } from '@simra/helpers';

@Component({
	selector: 'detail',
	imports: [CommonModule, ChartDetail, IntersectionList, IntersectionMap, Card, RouterLink, DateFilter],
	templateUrl: './detail.html',
})
export class IntersectionsDetailPage {
	private readonly _router = inject(Router);
	private readonly _requestService = inject(IntersectionsRequestService);

	protected readonly id = input.required<string>();
	protected readonly intersectionData = signal<FeatureCollection<LineString> | undefined>(undefined);

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

			const mode = this._mode();
			if (mode === "PRECOMPUTED") {
				const trafficTime = this._selectedTrafficTime();
				const weekDay = this._selectedWeekDays();
				const year = this._selectedYear();
				
				this.intersectionData.set(await this._requestService.getIntersectionBase({
					id: Number(baseId),
					trafficTime: trafficTime,
					weekDay: weekDay,
					year: year
				}))
			} else {
				const datetime = this._datetime$();
				if (datetime.length != 2) return;

				const startDate = datetime[0];
				const startHourMinute = this._startTime();
				startDate.setHours(startHourMinute.getHours());
				startDate.setMinutes(startHourMinute.getMinutes());

				const endDate = datetime[1];
				const endHourMinute = this._endTime();
				endDate.setHours(endHourMinute.getHours());
				endDate.setMinutes(endHourMinute.getMinutes());

				console.log(startDate, endDate)

				this.intersectionData.set(await this._requestService.getIntersectionBase({
					id: Number(baseId),
					startDate: startDate,
					endDate: endDate
				}))

				// TODO: complete backend part
			}
		});
	}

	protected readonly isNode = computed(() => 
        !!this.intersectionData()?.features[0]?.properties?.["trafficSignalClusterId"]
    );

	// Node
	protected readonly trafficSignalClusterId = computed(() => 
        this.intersectionData()?.features[0]?.properties?.["trafficSignalClusterId"] ?? NaN
    );
	protected readonly startOsmId = computed(() => 
        this.intersectionData()?.features[0]?.properties?.["startOsmId"] ?? null
    );
	protected readonly endOsmId = computed(() => 
        this.intersectionData()?.features[0]?.properties?.["endOsmId"] ?? null
    );
	protected readonly nodeRows = computed(() => {
		const isNode = this.isNode();
		const intersectionData = this.intersectionData();
		if (intersectionData && isNode) {
			return mapNodeToRows(intersectionData);
		}
		return [];
	});
	protected readonly nodeColumns: ListColumn<NodeRow>[] = [
		{ field: 'id', header: 'ID', display: "zoomOnLine" },
		{ field: 'streetNames', header: 'Name', sortable: true },
		{ field: 'rideId', header: 'Ride ID' },
		{ field: 'startTime', header: 'Start Time', sortable: true, display: "date" },
		{ field: 'speed', header: 'INTERSECTIONS.HEADERS.SPEED', sortable: true, display: "decimal"  },
		{ field: 'length', header: 'INTERSECTIONS.HEADERS.LENGTH', sortable: true, display: "decimal" },
		{ field: 'duration', header: 'INTERSECTIONS.HEADERS.DURATION', sortable: true, display: "decimal"  },
		{ field: 'waitingTime', header: 'INTERSECTIONS.HEADERS.MEDIANWAITINGTIME', sortable: true, display: "decimal"  },
	];

	// Edge
	protected readonly prevOsmId = computed(() => 
        this.intersectionData()?.features[0]?.properties?.["prevOsmId"] ?? null
    );
	protected readonly osmId = computed(() => 
        this.intersectionData()?.features[0]?.properties?.["osmId"] ?? null
    );
	protected readonly nextOsmId = computed(() => 
        this.intersectionData()?.features[0]?.properties?.["nextOsmId"] ?? null
    );
	protected readonly edgeRows = computed(() => {
		const isNode = this.isNode();
		const intersectionData = this.intersectionData();
		if (intersectionData && !isNode) {
			return mapEdgeToRows(intersectionData);
		}
		return [];
	});
	protected readonly edgeColumns: ListColumn<EdgeRow>[] = [
		{ field: 'id', header: 'ID', display: "zoomOnLine" },
		{ field: 'name', header: 'Name', sortable: true },
		{ field: 'rideId', header: 'Ride ID' },
		{ field: 'startTime', header: 'Start Time', sortable: true, display: "date" },
		{ field: 'speed', header: 'INTERSECTIONS.HEADERS.SPEED', sortable: true, display: "decimal"  },
		{ field: 'length', header: 'INTERSECTIONS.HEADERS.LENGTH', sortable: true, display: "decimal" },
		{ field: 'duration', header: 'INTERSECTIONS.HEADERS.DURATION', sortable: true, display: "decimal"  },
		{ field: 'waitingTime', header: 'INTERSECTIONS.HEADERS.MEDIANWAITINGTIME', sortable: true, display: "decimal"  },
	];

	

	handleZoom(row: IntersectionRow) {
		applyQueryParamsForLineHighlight(this._router, row.id, row.midPoint[1], row.midPoint[0], true, "intersectionLineData");
		scrollToElementId('intersection-map');
	}
}
