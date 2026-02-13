import { Component, effect, input, inject, signal, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { Card } from 'primeng/card';
import { Feature, FeatureCollection, GeoJsonProperties, LineString, Point, Polygon } from 'geojson';
import { IntersectionsAggregateFacade } from '@simra/intersections-domain';
import { IntersectionNodeAggregateRequest, IntersectionList, IntersectionMap } from '@simra/intersections-common';
import { EYear, ETrafficTimes, EWeekDays } from '@simra/common-models';
import { 
	DateFilter, DATE_FILTER_DEFAULTS, ECardMode,
	BaseRow,
	IntersectionNodeAggregateRow,
	mapIntersectionNodeAggregateToRows,
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
	private readonly _intersectionsAggregateFacade = inject(IntersectionsAggregateFacade);
	intersectionNodeAggregate = signal<FeatureCollection<LineString> | undefined>(undefined);
	trafficSignalClusterId = input.required<number>();

	protected _mode = signal<ECardMode>(DATE_FILTER_DEFAULTS.mode);
    protected _selectedYear = signal<EYear>(DATE_FILTER_DEFAULTS.year);
    protected _selectedWeekDays = signal<EWeekDays[]>(DATE_FILTER_DEFAULTS.weekDays);
    protected _selectedTrafficTime = signal<ETrafficTimes>(DATE_FILTER_DEFAULTS.trafficTime);
    protected _startTime = signal<Date>(DATE_FILTER_DEFAULTS.startTime);
    protected _endTime = signal<Date>(DATE_FILTER_DEFAULTS.endTime);
    protected _datetime$ = signal<Date[]>(DATE_FILTER_DEFAULTS.getDatetime());

	protected readonly nodeRows = signal<IntersectionNodeAggregateRow[]>([]);
	protected readonly nodeColumns: ListColumn<IntersectionNodeAggregateRow>[] = [
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

	constructor() {
		effect(async () => {
			const id = this.trafficSignalClusterId();
			if (!id) return;
			let requestFilter: IntersectionNodeAggregateRequest = {trafficSignalClusterId: id}
			if (this._mode() === ECardMode.PRECOMPUTED) {
				requestFilter = {
					trafficSignalClusterId: id,
					weekDay: this._selectedWeekDays(),
					trafficTime: [this._selectedTrafficTime()],
					year: [this._selectedYear()]
				};
			} 
			const data = await this._intersectionsAggregateFacade.getIntersectionNodeAggregateWithFilter(requestFilter);
			this.intersectionNodeAggregate.set(data.geoData);
			this.nodeRows.set(mapIntersectionNodeAggregateToRows(data.geoData));
		});
	}

	handleZoom(row: BaseRow) {
		applyQueryParamsForLineHighlight(this._router, row.id, row.midPoint[1], row.midPoint[0], true, "intersectionLineData");
		scrollToElementId('intersection-map');
	}
}
