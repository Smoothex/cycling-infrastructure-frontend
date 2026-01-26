import { Component, effect, input, Input, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { Feature, FeatureCollection, GeoJsonProperties, LineString, Point, Polygon } from 'geojson';
import { 
	IntersectionNodeAggregateRow,
	mapIntersectionNodeAggregateToRows,
	ListColumn,
	applyQueryParamsForLineHighlight
} from '@simra/intersections-common';
import { scrollToElementId } from '@simra/helpers';



@Component({
	selector: 'list-aggregate',
	imports: [CommonModule,Card, TableModule, RouterLink],
	templateUrl: './list-aggregate.html',
	styleUrl: './list-aggregate.scss',
})
export class IntersectionsAggregateList {
	@Input() trafficSignalClusterId!: number;
	intersectionNodeAggregate = input<FeatureCollection<LineString> | undefined>();

	private readonly _router = inject(Router);
	private readonly _activatedRoute = inject(ActivatedRoute);
	private readonly queryParams = toSignal(this._activatedRoute.queryParams);

	protected readonly loading = signal(false);
	protected readonly rows = signal<IntersectionNodeAggregateRow[]>([]);
	highlightedRowId = signal<number | null>(null);

	protected readonly columns: ListColumn<IntersectionNodeAggregateRow>[] = [
		{ field: 'id', header: 'exampleId', display: "zoomOnLine" },
		{ field: 'clusterStartEndId', header: 'Start - End OSM ID', display: "clusterStartEndLink" },
		{ field: 'streetNames', header: 'Name', sortable: true },
		{ field: 'count', header: 'Count', sortable: true},
		{ field: 'avgDuration', header: 'Avg Duration (s)', sortable: true, display: "decimal"  },
		{ field: 'maxDuration', header: 'Max Duration (s)', sortable: true, display: "decimal" },
		{ field: 'medianWaitingTime', header: 'Median WaitingTime (s)', sortable: true, display: "decimal" },
		{ field: 'avgSpeed', header: 'Avg Speed (km/h)', sortable: true, display: "decimal"  },
		{ field: 'avgLength', header: 'Avg Length (m)', sortable: true, display: "decimal" },
	];

	constructor() {
		effect(() => {
			const value = this.intersectionNodeAggregate();
			if (value) {
				const rows: IntersectionNodeAggregateRow[] = mapIntersectionNodeAggregateToRows(value);
				this.rows.set(rows);
			}
		});

		effect(() => {
			const params = this.queryParams();
			this.highlightedRowId.set(
				params?.['id'] ? Number(params['id']) : null
			);
		})
	}

	zoomOnLine(row: IntersectionNodeAggregateRow) {
		applyQueryParamsForLineHighlight(this._router, row.id, row.midPoint[1], row.midPoint[0], true, "intersectionNodeAggregate");
		scrollToElementId('intersection-map');
	}
}
