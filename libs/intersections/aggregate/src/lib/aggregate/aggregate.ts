import { Component, effect, input, inject, signal, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { Card } from 'primeng/card';
import { FeatureCollection, LineString } from 'geojson';
import { IntersectionsRequestService } from '@simra/intersections-domain';
import { EdgeMetricRow, IntersectionList, IntersectionMap, mapEdgeMetricToRows } from '@simra/intersections-common';
import { EYear, ETrafficTimes, EWeekDays } from '@simra/common-models';
import { 
	DateFilter, DATE_FILTER_DEFAULTS, ECardMode,
	IntersectionRow,
	NodeMetricRow,
	mapNodeMetricToRows,
	ListColumn,
	applyQueryParamsForLineHighlight
} from '@simra/intersections-common';
import { scrollToElementId } from '@simra/helpers';


@Component({
	selector: 'lib-aggregate',
	imports: [CommonModule, Card, DateFilter, IntersectionList, IntersectionMap ],
	templateUrl: './aggregate.html',
})
export class IntersectionsAggregatePage {
	private readonly _router = inject(Router);
	private readonly _RequestService = inject(IntersectionsRequestService);

	protected readonly intersectionNodeAggregate = signal<FeatureCollection<LineString> | undefined>(undefined);
	protected readonly trafficSignalClusterId = input<number>(NaN);
	protected readonly osmId = input<number>(NaN);
	protected readonly isNode = signal<Boolean>(false);

	protected _mode = signal<ECardMode>(DATE_FILTER_DEFAULTS.mode);
    protected _selectedYear = signal<EYear>(DATE_FILTER_DEFAULTS.year);
    protected _selectedWeekDays = signal<EWeekDays>(DATE_FILTER_DEFAULTS.weekDays);
    protected _selectedTrafficTime = signal<ETrafficTimes>(DATE_FILTER_DEFAULTS.trafficTime);
    protected _startTime = signal<Date>(DATE_FILTER_DEFAULTS.startTime); // Not used
    protected _endTime = signal<Date>(DATE_FILTER_DEFAULTS.endTime); // Not used
    protected _datetime$ = signal<Date[]>(DATE_FILTER_DEFAULTS.getDatetime()); // Not used

	protected readonly nodeRows = signal<NodeMetricRow[]>([]);
	protected readonly nodeColumns: ListColumn<NodeMetricRow>[] = [
		{ field: 'id', header: 'exampleId', display: "zoomOnLine" },
		{ field: 'clusterStartEndLink', header:'INTERSECTIONS.HEADERS.STARTENDOSMID', display: "link" },
		{ field: 'streetNames', header: 'Name', sortable: true },
		{ field: 'numberOfRides', header: 'INTERSECTIONS.HEADERS.RIDES', sortable: true },
		{ field: 'medianSpeed', header: 'INTERSECTIONS.HEADERS.SPEED', sortable: true, display: "decimal"  },
		{ field: 'medianLength', header: 'INTERSECTIONS.HEADERS.LENGTH', sortable: true, display: "decimal" },
		{ field: 'medianDuration', header: 'INTERSECTIONS.HEADERS.DURATION', sortable: true, display: "decimal"  },
		{ field: 'medianWaitingTime', header: 'INTERSECTIONS.HEADERS.MEDIANWAITINGTIME', sortable: true, display: "decimal" },
		{ field: 'maxWaitingTime', header: 'INTERSECTIONS.HEADERS.MAXWAITINGTIME', sortable: true, display: "decimal" },
	];

	protected readonly edgeRows = signal<EdgeMetricRow[]>([]);
	protected readonly edgeColumns: ListColumn<EdgeMetricRow>[] = [
		{ field: 'id', header: 'exampleId', display: "zoomOnLine" },
		{ field: 'prevOsmNextLink', header:'INTERSECTIONS.HEADERS.STARTENDOSMID', display: "link" },
		{ field: 'name', header: 'Name', sortable: true },
		{ field: 'numberOfRides', header: 'INTERSECTIONS.HEADERS.RIDES', sortable: true },
		{ field: 'medianSpeed', header: 'INTERSECTIONS.HEADERS.SPEED', sortable: true, display: "decimal"  },
		{ field: 'medianLength', header: 'INTERSECTIONS.HEADERS.LENGTH', sortable: true, display: "decimal" },
		{ field: 'medianDuration', header: 'INTERSECTIONS.HEADERS.DURATION', sortable: true, display: "decimal"  },
		{ field: 'medianWaitingTime', header: 'INTERSECTIONS.HEADERS.MEDIANWAITINGTIME', sortable: true, display: "decimal" },
		{ field: 'maxWaitingTime', header: 'INTERSECTIONS.HEADERS.MAXWAITINGTIME', sortable: true, display: "decimal" },
	];

	constructor() {
		effect(async () => {
			const id = this.trafficSignalClusterId();
			if (!id) return;
			const data = await this._RequestService.getIntersectionNodeMetricsPageable({
				numberOfRides: 0,
				trafficSignalClusterId: id,
				weekDay: this._selectedWeekDays(),
				trafficTime: this._selectedTrafficTime(),
				year: this._selectedYear()
			});
			this.intersectionNodeAggregate.set(data.geoData);
			this.nodeRows.set(mapNodeMetricToRows(data.geoData));
		});

		effect(async () => {
			const id = this.osmId();
			if (!id) return;
			const data = await this._RequestService.getIntersectionEdgeMetricsPageable({
				numberOfRides: 0,
				osmId: id,
				weekDay: this._selectedWeekDays(),
				trafficTime: this._selectedTrafficTime(),
				year: this._selectedYear()
			});
			this.intersectionNodeAggregate.set(data.geoData);
			this.edgeRows.set(mapEdgeMetricToRows(data.geoData));
		});
	}

	handleZoom(row: IntersectionRow) {
		applyQueryParamsForLineHighlight(this._router, row.id, row.midPoint[1], row.midPoint[0], true, "intersectionLineData");
		scrollToElementId('intersection-map');
	}
}
