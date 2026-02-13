import {
	ChangeDetectionStrategy,
	Component,
	inject,
	resource,
	signal,
	ViewEncapsulation,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
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
import { Column, EHighwayTypes, ESortOrder, ETrafficTimes, EWeekDays, EYear } from '@simra/common-models';
import { IStreetsSafetyMetricsRequest } from '@simra/streets-common';
import { StreetDetailViewFacade, StreetListViewFacade } from '@simra/streets-domain';
import { times } from 'lodash';
import { MarkdownComponent } from 'ngx-markdown';
import { PrimeTemplate } from 'primeng/api';
import { Card } from 'primeng/card';
import { Skeleton } from 'primeng/skeleton';
import { TableLazyLoadEvent } from 'primeng/table';
import { TableModule } from 'primeng/table';
import { CommonModule } from '@angular/common';
import { Tooltip } from 'primeng/tooltip';
import { firstValueFrom, Observable } from 'rxjs';
import { HIGHWAY_TYPES_TO_TRANSLATION } from '../../../translations/maps/highway-types-to-translation';

@Component({
	selector: 't-street-list-view',
	standalone: true,
	imports: [
		CommonModule,
		PrimeTemplate,
		TableModule,
		TranslatePipe,
		Tooltip,
		Card,
		Skeleton,
		TranslateModule,
		FormsModule,
		NumberFilterComponent,
		EnumMultiSelectComponent,
		RouterLink,
		AutocompleteComponent,
		LastRunComponent,
		MarkdownComponent,
	],
	templateUrl: './street-list-view.page.html',
	styleUrl: './street-list-view.page.scss',
	host: {
		class: 't-street-list-view',
	},
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StreetListViewPage {
	private readonly _streetDetailViewFacade = inject(StreetDetailViewFacade);
	private readonly _streetListViewFace = inject(StreetListViewFacade);
	/**
	 * The index of the current page
	 * @protected
	 */
	protected index = 0;
	/**
	 * Indicates if the table is loading with skeleton
	 * @protected
	 */
	protected readonly loading = signal<boolean>(false);
	private readonly _headerPrefix = 'STREETS.EXPLORER.GENERAL.TABLE.HEADER.COLUMNS';
	/**
	 * Defines the columns which are displayed in the table
	 * @protected
	 */
	protected readonly _cols: Column[] = [
		{
			header: `COMPONENTS.GENERAL.TABLE.HEADER.COLUMNS.OSM_ID`,
			field: 'id',
			sortable: true,
			fetchFunction: (query: string): Observable<string[]> => {
				return this._streetListViewFace.fetchStreetIds(query);
			},
		} as AutocompleteColumn,
		{
			header: `${this._headerPrefix}.NAME`,
			field: 'name',
			fetchFunction: (query: string): Observable<string[]> => {
				return this._streetListViewFace.fetchStreetNames(query);
			},
		} as AutocompleteColumn,
		{
			header: `${this._headerPrefix}.HIGHWAY_TYPE`,
			field: 'highway',
			enum: EHighwayTypes,
			filter: true,
			translationMap: HIGHWAY_TYPES_TO_TRANSLATION,
		} as EnumColumn<EHighwayTypes>,
		{
			header: `${this._headerPrefix}.SCORE`,
			field: 'dangerousScore',
			min: 0,
			step: 0.05,
			sortable: true,
		} as NumberColumn,
		{
			header: `${this._headerPrefix}.RIDES`,
			field: 'numberOfRides',
			min: 5,
			step: 10,
			sortable: true,
		} as NumberColumn,
		{
			header: `${this._headerPrefix}.INCIDENTS`,
			field: 'numberOfIncidents',
			min: 0,
			step: 10,
			sortable: true,
		} as NumberColumn,
		{
			header: `${this._headerPrefix}.WEEKDAY`,
			field: 'weekDay',
			enum: EWeekDays,
			translationMap: WEEK_DAYS_TO_TRANSLATION,
			sortable: true,
		} as EnumColumn<EWeekDays>,
		{
			header: `${this._headerPrefix}.TRAFFIC_TIME`,
			field: 'trafficTime',
			enum: ETrafficTimes,
			translationMap: TRAFFIC_TIMES_TO_TRANSLATION,
			sortable: true,
		} as EnumColumn<ETrafficTimes>,
		{
			header: `${this._headerPrefix}.YEAR`,
			enum: EYear,
			translationMap: YEAR_TO_TRANSLATION,
			field: 'year',
			sortable: false,
		} as EnumColumn<EYear>,
	];

	protected readonly _lastRun$ = toSignal(
		this._streetDetailViewFacade.fetchLastMethodRun('updateSafetyMetrics'),
	);
	public fetchRegionNames = (query: string): Observable<string[]> => {
		return this._streetListViewFace.fetchRegionNames(query);
	};
	protected readonly filtering = signal<IStreetsSafetyMetricsRequest>({
		size: 20,
		weekDay: [EWeekDays.ALL_WEEK],
		trafficTime: [ETrafficTimes.ALL_DAY],
		year: [EYear.ALL],
		minNumberOfRides: 40,
		sort: 'dangerousScore,DESC',
	});
	protected readonly _streets$ = resource({
		request: () => ({ ...this.filtering() }),
		loader: async ({ request }) => {
			this.loading.set(true);
			const response = await firstValueFrom(
				this._streetListViewFace.fetchStreetList(request),
			);
			this.loading.set(false);
			return response;
		},
	});

	/**
	 * Called when paginating the table
	 * @param event
	 */
	onLazy(event: TableLazyLoadEvent) {
		this.filtering.update((oldValues) => ({
			...oldValues,
			page: event.first / event.rows,
			size: event.rows,
		}));
	}

	/**
	 * Called when filtering the table
	 * @param event
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	onFilterChange(event: any) {
		let newFilter = {};
		if (event.filters) {
			for (const filter in event.filters) {
				const numericValue = +event.filters[filter].value;
				if (isNaN(numericValue)) {
					newFilter[filter] = numericValue;
				} else {
					newFilter[filter] = event.filters[filter].value;
				}
			}
		} else {
			newFilter = event;
		}

		this.index = 0;
		this.filtering.update((oldValues) => ({
			...oldValues,
			...newFilter,
		}));
	}

	/**
	 * Called when sorting the table
	 * @param event
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	protected onSort(event: any) {
		const sort = event.field === 'id' ? 'planetOsmLineId' : event.field;
		const order = event.order === 1 ? ESortOrder.ASC : ESortOrder.DESC;
		this.filtering.update((oldValues) => ({
			...oldValues,
			sort: `${sort},${order}`,
		}));
	}

	/**
	 * The following methods are just references for the template
	 */
	protected readonly TRAFFIC_TIMES_TO_TRANSLATION = TRAFFIC_TIMES_TO_TRANSLATION;
	protected readonly WEEK_DAYS_TO_TRANSLATION = WEEK_DAYS_TO_TRANSLATION;
	protected readonly HIGHWAY_TYPES_TO_TRANSLATION = HIGHWAY_TYPES_TO_TRANSLATION;
	protected readonly isEnumColumn = isEnumColumn;
	protected readonly isNumberColumn = isNumberColumn;
	protected readonly times = times;

	protected async preloadStreet(id: number) {
		if (!id) {
			return;
		}
		await firstValueFrom(this._streetDetailViewFacade.getAndSetStreet(id));
	}

	protected isBasicColumn(column: Column): Column | undefined {
		if (!this.isEnumColumn(column) && !this.isNumberColumn(column)) {
			return column as Column;
		}
		return undefined;
	}

	protected readonly YEAR_TO_TRANSLATION = YEAR_TO_TRANSLATION;
	protected readonly isAutocompleteColumn = isAutocompleteColumn;
}
