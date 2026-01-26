import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { IntersectionsListFacade } from '@simra/intersections-domain';
import {
	IntersectionNodeAggregateRequest, 
	IntersectionNodeAggregateRow,
	mapIntersectionNodeAggregateToRows,
	IntersectionEdgeAggregateRequest,
	IntersectionEdgeAggregateRow,
	mapIntersectionEdgeAggregateToRows,
	ListColumn,
	HeaderFilterAutocomplete,
	HeaderFilterNumber,
} from '@simra/intersections-common';
import { TranslateModule, TranslatePipe } from '@ngx-translate/core';
import {
	EnumColumn,
	EnumMultiSelectComponent,
	isEnumColumn,
	isNumberColumn, AutocompleteComponent,
	NumberColumn,
	NumberFilterComponent,
	TRAFFIC_TIMES_TO_TRANSLATION,
	WEEK_DAYS_TO_TRANSLATION, YEAR_TO_TRANSLATION, AutocompleteColumn, isAutocompleteColumn, LastRunComponent,
} from '@simra/common-components';
import { Observable } from 'rxjs';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { Feature, FeatureCollection, GeoJsonProperties, LineString, Point, Polygon } from 'geojson';

@Component({
	selector: 'lib-list',
	imports: [CommonModule, FormsModule, Card, TableModule, ToggleButtonModule, RouterLink, AutocompleteComponent, NumberFilterComponent, TranslatePipe],
	templateUrl: './list.html',
	styleUrl: './list.scss',
})
export class IntersectionsList implements OnInit {
	private readonly _intersectionsListFacade = inject(IntersectionsListFacade);
	
	protected readonly nodeColumns: ListColumn<IntersectionNodeAggregateRow>[] = [
		{ field: 'trafficSignalClusterId', header: 'Intersection ID', sortable: true, display: "link" },
		{ field: 'clusterStartEndId', header: 'Start - End OSM ID', display: "clusterStartEndLink" },
		// { field: 'endOsmId', header: 'End OSM ID' },
		{ field: 'streetNames', header: 'Name', sortable: true, headerFilter: {dataType: 'autocomplete', 
			field: 'streetNames',
			fetchFunction: (query: string): Observable<string[]> => {
				this.nodeFilter.streetNames = query;
				return this._intersectionsListFacade.getIntersectionNodeStreetNames(this.nodeFilter);
			} }},
		{ field: 'count', header: 'Count', sortable: true, headerFilter: {dataType: 'number', field: 'count', step: 5, min: 0, default: 5}},
		// { field: 'maxDuration', header: 'Max Duration (s)', sortable: true, display: "decimal" },
		{ field: 'avgSpeed', header: 'Avg Speed (km/h)', sortable: true, display: "decimal"  },
		{ field: 'avgLength', header: 'Avg Length (m)', sortable: true, display: "decimal" },
		{ field: 'avgDuration', header: 'Avg Duration (s)', sortable: true, display: "decimal"  },
		// { field: 'avgWaitingTime', header: 'Avg WaitingTime (s)', sortable: true, display: "decimal"  },
		{ field: 'medianWaitingTime', header: 'Median WaitingTime (s)', sortable: true, display: "decimal" },
		{ field: 'maxWaitingTime', header: 'Max WaitingTime (s)', sortable: true, display: "decimal" }
	];
	protected nodeFilter: IntersectionNodeAggregateRequest = {
		trafficSignalClusterId: undefined,
		count: 5,
		region: undefined,
		streetNames: undefined
	};

	protected readonly edgeColumns: ListColumn<IntersectionEdgeAggregateRow>[] = [
		{ field: 'prevOsmNextId', header: 'Prev - End OSM ID', display: "prevOsmNextId" },
		{ field: 'name', header: 'Name', sortable: true, headerFilter: {dataType: 'autocomplete', 
			field: 'name',
			fetchFunction: (query: string): Observable<string[]> => {
				this.edgeFilter.name = query;
				return this._intersectionsListFacade.getIntersectionEdgeStreetNames(this.edgeFilter);
			} }},
		{ field: 'count', header: 'Count', sortable: true, headerFilter: {dataType: 'number', field: 'count', step: 5, min: 0, default: 5} },
		{ field: 'avgSpeed', header: 'Avg Speed (km/h)', sortable: true, display: "decimal"  },
		{ field: 'avgLength', header: 'Avg Length (m)', sortable: true, display: "decimal" },
		{ field: 'avgDuration', header: 'Avg Duration (s)', sortable: true, display: "decimal"  },
		{ field: 'medianWaitingTime', header: 'Median WaitingTime (s)', sortable: true, display: "decimal" },
		{ field: 'maxWaitingTime', header: 'Max WaitingTime (s)', sortable: true, display: "decimal" }
	];
	protected edgeFilter: IntersectionEdgeAggregateRequest = {
		count: 5,
		region: undefined,
		name: undefined
	};


	protected readonly loading = signal(false);
	protected readonly rows = signal<IntersectionNodeAggregateRow[] | IntersectionEdgeAggregateRow[]>([]);
	protected columns: ListColumn<IntersectionNodeAggregateRow>[] | ListColumn<IntersectionEdgeAggregateRow>[] = this.nodeColumns;
	public displayNodes = true;
	

	ngOnInit() {
		this.load();
	}

	protected asNumberFilter(filter: any): HeaderFilterNumber {
        return filter as HeaderFilterNumber;
    }

    protected asAutocompleteFilter(filter: any): HeaderFilterAutocomplete {
        return filter as HeaderFilterAutocomplete;
    }

	public fetchRegionNames = (query: string): Observable<string[]> => {
		return this._intersectionsListFacade.fetchRegionNames(query);
	};

	async load() {
		this.loading.set(true);
		if (this.displayNodes) {
			this.rows.set(mapIntersectionNodeAggregateToRows(await this._intersectionsListFacade.getIntersectionNodeAggregateWithFilter(this.nodeFilter)));
		} else {
			this.rows.set(mapIntersectionEdgeAggregateToRows(await this._intersectionsListFacade.getIntersectionEdgeAggregateWithFilter(this.edgeFilter)));
		}
  		this.loading.set(false);
	}

	onDisplayChange() {
		if (this.displayNodes) {
			this.columns = this.nodeColumns;
		} else {
			this.columns = this.edgeColumns;
		}
		this.load();
	}

	applyFilter<T>(event: any, keyMap: Record<string, keyof T>, filterObject: T) {
		let changed = false;
		Object.entries(keyMap).forEach(([eventKey, filterKey]) => {
			if (eventKey in event) {
				const newValue = event[eventKey] || undefined;

				if (filterObject[filterKey] !== newValue) {
					filterObject[filterKey] = newValue;
					changed = true;
				}
			}
		});

		return changed;
	}

	onFilterChange(event: any) {
		if (!event) return;

		const keyMapNode: Record<string, keyof IntersectionNodeAggregateRequest> = {
			region: 'region',
			streetNames: 'streetNames',
			name: 'streetNames',
			minCount: 'count',
		};
		let changed = this.applyFilter(event, keyMapNode, this.nodeFilter);
		
		const keyMapEdge: Record<string, keyof IntersectionEdgeAggregateRequest> = {
			region: 'region',
			streetNames: 'name',
			name: 'name',
			minCount: 'count'
		};
		changed = this.applyFilter(event, keyMapEdge, this.edgeFilter) || changed;

		if (changed) {
			this.load();
		}
	}
}
