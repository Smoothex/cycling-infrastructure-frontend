import { Component, effect, input, Input, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { Feature, FeatureCollection, GeoJsonProperties, LineString, Point, Polygon } from 'geojson';
import { IntersectionsRequestService } from '@simra/intersections-domain';
import { ChartDetail } from '../../components/chart/chart-detail'
import {
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
	imports: [CommonModule, ChartDetail, IntersectionList, IntersectionMap, Card, RouterLink],
	templateUrl: './detail.html',
})
export class IntersectionsDetailPage {
	private readonly _router = inject(Router);
	private readonly _requestService = inject(IntersectionsRequestService);

	protected readonly id = input.required<string>();
	protected readonly intersectionData = signal<FeatureCollection<LineString> | undefined>(undefined);

	constructor() {
		effect(async () => {
			const baseId = this.id();
			if (!baseId) return;

			this.intersectionData.set(await this._requestService.getIntersectionBase({
				id: Number(baseId)
			}))
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
