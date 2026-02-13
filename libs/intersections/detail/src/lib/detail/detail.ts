import { Component, effect, input, Input, signal, inject, numberAttribute } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { Feature, FeatureCollection, GeoJsonProperties, LineString, Point, Polygon } from 'geojson';
import { IntersectionsDetailFacade } from '@simra/intersections-domain';
import { ChartDetail } from '../../components/chart/chart-detail'
import {
	IntersectionNodeRow,
	mapIntersectionNodeToRows,
	IntersectionEdgeRow,
	mapIntersectionEdgeToRows,
	ListColumn,
	applyQueryParamsForLineHighlight,
	IntersectionList,
	IntersectionMap,
	BaseRow
} from '@simra/intersections-common';
import { scrollToElementId } from '@simra/helpers';

@Component({
	selector: 'detail',
	imports: [CommonModule, ChartDetail, IntersectionList, IntersectionMap, Card, RouterLink],
	templateUrl: './detail.html',
})
export class IntersectionsDetailPage {
	private readonly _router = inject(Router);
	private readonly _intersectionsDetailFacade = inject(IntersectionsDetailFacade);
	displayNodes = input<boolean, string>(true, {
		transform: (value) => value === "node",
	});

	// Node
	trafficSignalClusterId = input<number, string>(NaN, {
		transform: (value) => Number(value),
	});
	startOsmId = input<number | null, string>(null, {
		transform: (value) => value === 'null' ? null : Number(value),
	});
	endOsmId = input<number | null, string>(null, {
		transform: (value) => value === 'null' ? null : Number(value),
	});
	protected readonly nodeRows = signal<IntersectionNodeRow[]>([]);
	protected readonly nodeColumns: ListColumn<IntersectionNodeRow>[] = [
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
	prevOsmId = input<number | null, string>(null, {
		transform: (value) => value === 'null' ? null : Number(value),
	});
	osmId = input<number | null, string>(null, {
		transform: (value) => value === 'null' ? null : Number(value),
	});
	nextOsmId = input<number | null, string>(null, {
		transform: (value) => value === 'null' ? null : Number(value),
	});
	protected readonly edgeRows = signal<IntersectionEdgeRow[]>([]);
	protected readonly edgeColumns: ListColumn<IntersectionEdgeRow>[] = [
		{ field: 'id', header: 'ID', display: "zoomOnLine" },
		{ field: 'name', header: 'Name', sortable: true },
		{ field: 'rideId', header: 'Ride ID' },
		{ field: 'startTime', header: 'Start Time', sortable: true, display: "date" },
		{ field: 'speed', header: 'INTERSECTIONS.HEADERS.SPEED', sortable: true, display: "decimal"  },
		{ field: 'length', header: 'INTERSECTIONS.HEADERS.LENGTH', sortable: true, display: "decimal" },
		{ field: 'duration', header: 'INTERSECTIONS.HEADERS.DURATION', sortable: true, display: "decimal"  },
		{ field: 'waitingTime', header: 'INTERSECTIONS.HEADERS.MEDIANWAITINGTIME', sortable: true, display: "decimal"  },
	];

	// Node and Edge
	intersectionData = signal<FeatureCollection<LineString> | undefined>(undefined);

	constructor() {
		effect(async () => {
			if (this.displayNodes()) {
				if (!isNaN(this.trafficSignalClusterId())) {
					const data = await this._intersectionsDetailFacade.getIntersectionNodeFiltered(this.trafficSignalClusterId(), this.startOsmId(), this.endOsmId());
					this.intersectionData.set(data);
					debugger
					this.nodeRows.set(mapIntersectionNodeToRows(data));
				}
			} else {
				const data = await this._intersectionsDetailFacade.getIntersectionEdgeFiltered(this.prevOsmId(), this.osmId(), this.nextOsmId())
				this.intersectionData.set(data);
				this.edgeRows.set(mapIntersectionEdgeToRows(data));
			}
		});
	}

	handleZoom(row: BaseRow) {
		applyQueryParamsForLineHighlight(this._router, row.id, row.midPoint[1], row.midPoint[0], true, "intersectionLineData");
		scrollToElementId('intersection-map');
	}
}
