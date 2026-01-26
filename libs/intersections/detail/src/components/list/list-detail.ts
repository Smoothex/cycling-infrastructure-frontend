import { Component, effect, input, Input, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { Feature, FeatureCollection, GeoJsonProperties, LineString, Point, Polygon } from 'geojson';
import {
	IntersectionNodeRow,
	mapIntersectionNodeToRows,
	IntersectionEdgeRow,
	mapIntersectionEdgeToRows,
	ListColumn,
	applyQueryParamsForLineHighlight
} from '@simra/intersections-common';
import { scrollToElementId } from '@simra/helpers';


@Component({
	selector: 'list-detail',
	imports: [CommonModule,Card, TableModule],
	templateUrl: './list-detail.html',
	styleUrl: './list-detail.scss',
})
export class ListDetail {
	private readonly _router = inject(Router);
	private readonly _activatedRoute = inject(ActivatedRoute);
	private readonly queryParams = toSignal(this._activatedRoute.queryParams);

	@Input({required: true}) displayNodes!: boolean;
	intersectionData = input<FeatureCollection<LineString> | undefined>();

	protected readonly loading = signal(false);
	protected readonly rows = signal<IntersectionNodeRow[] | IntersectionEdgeRow[]>([]);
	highlightedRowId = signal<number | null>(null);

	protected readonly nodeColumns: ListColumn<IntersectionNodeRow>[] = [
		{ field: 'id', header: 'ID', display: "zoomOnLine" },
		{ field: 'streetNames', header: 'Name', sortable: true },
		{ field: 'rideId', header: 'Ride ID', display: "clusterStartEndLink" },
		{ field: 'startTime', header: 'Start Time', sortable: true, display: "date"},
		{ field: 'duration', header: 'Duration (s)', sortable: true, display: "decimal"  },
		{ field: 'waitingTime', header: 'Waiting Time (s)', sortable: true, display: "decimal"  },
		{ field: 'speed', header: 'Speed (km/h)', sortable: true, display: "decimal"  },
		{ field: 'length', header: 'Length (m)', sortable: true, display: "decimal" },
	];
	protected readonly edgeColumns: ListColumn<IntersectionEdgeRow>[] = [
		{ field: 'id', header: 'ID', display: "zoomOnLine" },
		{ field: 'name', header: 'Name', sortable: true },
		{ field: 'rideId', header: 'Ride ID', display: "clusterStartEndLink" },
		{ field: 'startTime', header: 'Start Time', sortable: true, display: "date"},
		{ field: 'duration', header: 'Duration (s)', sortable: true, display: "decimal"  },
		{ field: 'waitingTime', header: 'Waiting Time (s)', sortable: true, display: "decimal"  },
		{ field: 'speed', header: 'Speed (km/h)', sortable: true, display: "decimal"  },
		{ field: 'length', header: 'Length (m)', sortable: true, display: "decimal" },
	];
	protected columns: ListColumn<IntersectionNodeRow>[] | ListColumn<IntersectionEdgeRow>[] = this.nodeColumns;

	constructor() {
		effect(() => {
			const value = this.intersectionData();
			if (value) {
				if (this.displayNodes) {
					this.columns = this.nodeColumns;
					this.rows.set(mapIntersectionNodeToRows(value));
				} else {
					this.columns = this.edgeColumns;
					this.rows.set(mapIntersectionEdgeToRows(value));
				}
			}
		});

		effect(() => {
			const params = this.queryParams();
			this.highlightedRowId.set(
				params?.['id'] ? Number(params['id']) : null
			);
		})
	}

	zoomOnLine(row: IntersectionNodeRow | IntersectionEdgeRow) {
		applyQueryParamsForLineHighlight(this._router, row.id, row.midPoint[1], row.midPoint[0], true, "intersectionLineData");
		scrollToElementId('intersection-map');
	}
}
