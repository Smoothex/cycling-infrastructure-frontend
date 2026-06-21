import { Component, input, computed, signal, effect, untracked, linkedSignal, WritableSignal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Card } from 'primeng/card';
import { Button } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { Skeleton } from 'primeng/skeleton';
import {
	PrecomputedPageableRequest,
	PagedProperties,
	PageableRequest,
	ChartConfig,
	ChartFilter,
	TimeCategory
} from '../../lib/common/interfaces';
import {
	TRAFFIC_TIMES_TO_TRANSLATION,
	WEEK_DAYS_TO_TRANSLATION, 
	YEAR_TO_TRANSLATION
} from '@simra/common-components';
import { BoxplotChartComponent } from './chart-types/boxplot/boxplot';
import { HistogramChartComponent } from './chart-types/histogram/histogram';
import { HeatmapChartComponent } from './chart-types/heatmap/heatmap';
import { HeatmapStartTimeChartComponent } from './chart-types/heatmap-startTime/heatmap';
import { ScatterPlotComponent } from './chart-types/scatterplot/scatterplot';
import { ScatterPlotStartTimeComponent } from './chart-types/scatterplot-startTime/scatterplot';
import { ETrafficTimes, EWeekDays, EYear } from '@simra/common-models';
import { TranslateService } from '@ngx-translate/core';

const TimeCatergoryLabelTranslations: Record<TimeCategory, any> = {
	trafficTime: TRAFFIC_TIMES_TO_TRANSLATION,
	weekDay: WEEK_DAYS_TO_TRANSLATION,
	year: YEAR_TO_TRANSLATION,
}

@Component({
	selector: 'intersection-chart',
	imports: [FormsModule, Card, ChartModule, Skeleton, Button, HistogramChartComponent, BoxplotChartComponent, HeatmapChartComponent, HeatmapStartTimeChartComponent, ScatterPlotComponent, ScatterPlotStartTimeComponent],
	templateUrl: './chart.html'
})
export class IntersectionChartComponent<T, R extends PageableRequest | PrecomputedPageableRequest> {
	public readonly header = input.required<string>();
    public readonly config = input.required<ChartConfig<T>>();

	public readonly request = input.required<R | null>();
	public readonly requestWithoutSorting = computed(() => {
		const r = this.request();
		if (!r) return null;
		const newRequest = { ...r };
		newRequest.sort = undefined;
		return newRequest;
	})
	public readonly fetchFn = input.required<(req: R, page: number, size: number) => Promise<PagedProperties<T>>>();

	public readonly requestValue = computed(() => {
		const request = this.requestWithoutSorting();
		if (!this.compare() || !request) return request;
		const timeCategory = this.timeCategory();
		if (timeCategory in request) {
			const newRequest = <PrecomputedPageableRequest> {...request };
			(newRequest[timeCategory] as any) = this.currentTimeCategorySignals().timeCategoryValue();
			return <R> newRequest;
		}
		return request;
	});
    private readonly pageSize = 500;
	protected readonly pagedProperties = signal<PagedProperties<T>| null>(null);
	protected readonly totalElements = computed(() => this.getTotalElements(this.pagedProperties()));
    protected readonly loading = signal(false);
	protected readonly accumulatedData = signal<T[]>([]);
	readonly showScatter = computed(() => this.accumulatedData().length < 300);


	protected filterMin = signal<number | null>(null);
    protected filterMax = signal<number | null>(null);
	protected filterProperty = linkedSignal(() => this.config().defaultProperty2);
	protected filterPropertyLabel = computed(() => {
		for (const el of this.config().selectableProperties) if (el.value === this.filterProperty()) return el.label;
		return "";
	});
	protected readonly filteredData = computed<T[]>(() => this.filterData(this.accumulatedData(), this.filterProperty(), this.filterMin(), this.filterMax()));
	protected total = computed<number>(() => this.accumulatedData().length);
	protected excluded = computed<number>(() => this.accumulatedData().length - this.filteredData().length);
	protected chartFilter = computed<ChartFilter<T>>(() => {
		const currentTimeCategorySignals = this.currentTimeCategorySignals();
		return {
			min: this.filterMin,
			max: this.filterMax,
			onProperty: this.filterProperty,
			onPropertyLabel: this.filterPropertyLabel, 
			totalElements: this.total,
			excludedElements: this.excluded,
			selectableProperties: this.config().selectableProperties,
			...(this.compare() && {
				timeCategory: this.timeCategory,
				timeCategoryValue: currentTimeCategorySignals.timeCategoryValue,
				timeCategoryCompare: currentTimeCategorySignals.timeCategoryCompare
			})
		}
	});
	

	protected propertyChart = linkedSignal(() => this.config().defaultProperty);
	protected readonly label = computed(() => {
		for (const el of this.config().selectableProperties) if (el.value === this.propertyChart()) return el.label;
		return "";
	});

	protected timeCategory = signal<TimeCategory>("year");
	protected timeCategoryYear = linkedSignal<EYear>(() => {
		const request = this.requestWithoutSorting();
		if (request && "year" in request) return request.year as EYear;
		return EYear.ALL;
	});
	protected timeCategoryYearCompare = signal<EYear>(EYear.Y2020);
	protected timeCategoryWeekDay = linkedSignal<EWeekDays>(() => {
		const request = this.requestWithoutSorting();
		if (request && "weekDay" in request) return request.weekDay as EWeekDays;
		return EWeekDays.ALL_WEEK;
	});
	protected timeCategoryWeekDayCompare = signal<EWeekDays>(EWeekDays.WEEKEND);
	protected timeCategoryTrafficTime = linkedSignal<ETrafficTimes>(() => {
		const request = this.requestWithoutSorting();
		if (request && "trafficTime" in request) return request.trafficTime as ETrafficTimes;
		return ETrafficTimes.ALL_DAY;
	});
	protected timeCategoryTrafficTimeCompare = signal<ETrafficTimes>(ETrafficTimes.MID_DAY);
	protected currentTimeCategorySignals = computed(() => {
		const timeCategorySignals: Record<TimeCategory, { 
			timeCategoryValue: WritableSignal<EYear> | WritableSignal<EWeekDays> | WritableSignal<ETrafficTimes>;
			timeCategoryCompare: WritableSignal<EYear> | WritableSignal<EWeekDays> | WritableSignal<ETrafficTimes>;
		}> = {
			year: {
				timeCategoryValue: this.timeCategoryYear,
				timeCategoryCompare: this.timeCategoryYearCompare
			},
			weekDay: {
				timeCategoryValue: this.timeCategoryWeekDay,
				timeCategoryCompare: this.timeCategoryWeekDayCompare
			},
			trafficTime: {
				timeCategoryValue: this.timeCategoryTrafficTime,
				timeCategoryCompare: this.timeCategoryTrafficTimeCompare
			}
		}
		return timeCategorySignals[this.timeCategory()];
	});
	protected readonly compare = computed(() => this.config().isAggregated ?? false);
	protected readonly comparePagedProperties = signal<PagedProperties<T> | null>(null);
	protected readonly compareTotalElements = computed(() => this.getTotalElements(this.comparePagedProperties()));
	protected readonly compareAccumulatedData = signal<T[]>([]);
	protected readonly compareFilteredData = computed<T[]>(() => this.filterData(this.compareAccumulatedData(), this.filterProperty(), this.filterMin(), this.filterMax()));
	public readonly requestCompare = computed(() => {
		const request = this.request();
		if (!this.compare() || !request) return request;
		const timeCategory = this.timeCategory();
		if (timeCategory in request) {
			const newRequest = <PrecomputedPageableRequest> {...request };
			(newRequest[timeCategory] as any) = this.currentTimeCategorySignals().timeCategoryCompare();
			return  <R> newRequest;
		}
		return request;
	});
	protected readonly compareConfig = computed<ChartConfig<Record<string, any>> | null>(() => {
		const config = this.config();
		if (!this.compare() || !config || !this.config().canCompare) return null;
		const timeCategory = this.timeCategory();
		const translation = TimeCatergoryLabelTranslations[timeCategory] as any;
        const labelMap: Record<string, string> = {};
        for (const [key, value] of Object.entries(translation)) {
            labelMap[key] = this.translate.instant((value as any).label);
        }

		const c1 = this.currentTimeCategorySignals().timeCategoryValue();
		const c2 = this.currentTimeCategorySignals().timeCategoryCompare();

		const l1 = labelMap[c1];
		const l2 = labelMap[c2];

		const options: ({value: string; label: string})[] = []; 
		config.selectableProperties.forEach(option => {
			options.push({label: `${l1}: ${option.label}`, value: `${c1}${String(option.value)}`})
			options.push({label: `${l2}: ${option.label}`, value: `${c2}${String(option.value)}`})
			options.push({ label: `Change ${l1} to ${l2}: ${option.label}`, value: `${c2}${c1}${String(option.value)}`})
		})

		return {
			selectableProperties: options,
			defaultProperty: `${c2}${c1}${String(config.defaultProperty)}`, 
			defaultProperty2: `${c2}${c1}${String(config.defaultProperty2)}`,
			aggregationLabel: config.aggregationLabel,
			isAggregated: config.isAggregated,
			idKey: config.idKey as string
		};
	})
	protected readonly compareProperty = linkedSignal(() => this.compareConfig()?.defaultProperty || "");
	protected readonly compareLabel = computed(() => {
		const config = this.compareConfig();
		if (!config) return "";
		for (const el of config.selectableProperties) if (el.value === this.compareProperty()) return el.label;
		return "";
	});
	protected readonly mergedCompareData = computed<Record<string, any>[]>(() => {
		const config = this.config();
		if (!this.compare() || !config || !this.config().canCompare) return [];

		const idKey = config.idKey as string;
		
		const c1 = this.currentTimeCategorySignals().timeCategoryValue() as string;
		const c2 = this.currentTimeCategorySignals().timeCategoryCompare() as string;

		const segmentMap = new Map<number | string, Record<string, any>>();

		const data1 = this.filteredData();
		data1.forEach((item: any) => {
			const id = item[idKey];

			const entry: any = {
				[idKey]: id 
			}
			config.selectableProperties.forEach(prop => {
				const propStr = String(prop.value);
				entry[`${c1}${propStr}`] = item[propStr];
			});
			segmentMap.set(id, entry);
		});
		const data2 = this.compareFilteredData();
		data2.forEach((item: any) => {
			const id = item[idKey];

			if (segmentMap.has(id)) {
                const entry: any = segmentMap.get(id)!;
				config.selectableProperties.forEach(prop => {
					const propStr = String(prop.value);
					entry[`${c2}${propStr}`] = item[propStr];
				});
            }
		});

		const mergedArray = Array.from(segmentMap.values());
		const filteredMergedArray: Record<string, any>[] = [];
		
		mergedArray.forEach(segment => {
			let hasValidData = false;
			config.selectableProperties.forEach(prop => {
				const propStr = String(prop.value);
				const val1 = segment[`${c1}${propStr}`];
				const val2 = segment[`${c2}${propStr}`];

				if (typeof val1 === 'number' && typeof val2 === 'number') {
					segment[`${c2}${c1}${propStr}`] = val2 - val1;
					hasValidData = true;
				} else {
					segment[`${c2}${c1}${propStr}`] = null;
				}
			});
			if (hasValidData) filteredMergedArray.push(segment);
		});

		return filteredMergedArray;
	});

	private translate = inject(TranslateService);
	constructor() {
		effect(() => {
			const request = this.requestValue();
			const requestCompare = this.requestCompare();
			if (!request || !requestCompare) return;
			untracked(() => {
				this.resetAndFetchAll(request, requestCompare);
			});
		})
	}

	private async resetAndFetchAll(requestValue: R, requestCompare: R) {
        await this.resetAndFetch(this.pagedProperties, this.accumulatedData, requestValue);
		if (this.compare()) await this.resetAndFetch(this.comparePagedProperties, this.compareAccumulatedData, requestCompare);
    }

	private async resetAndFetch(props: WritableSignal<PagedProperties<T> | null>, data: WritableSignal<T[]>, request: R | null) {
        data.set([]);
        props.set(null);
        await this.loadMore(props, data, request);
    }

	protected async loadMore(props: WritableSignal<PagedProperties<T> | null>, data: WritableSignal<T[]>, request: R | null) {
        if (this.loading() || !request) return;
        
		const pagedProps = props();
        const page = pagedProps ? pagedProps.metadata.currentPage + 1 : 0;
		if (pagedProps && pagedProps.metadata.totalPages <= page) return;
		
		this.loading.set(true);
		const result = await this.fetchFn()(request, page, this.pageSize);
		data.update(current => [...current, ...result.properties]);
		props.set(result);
		this.loading.set(false);
    }

	protected async loadAllPages(props: WritableSignal<PagedProperties<T> | null>, data: WritableSignal<T[]>, request: R | null) {
		const pagedProps = props();
        if (this.loading() || !request || !pagedProps) return;
		
		this.loading.set(true);

		for (let page = pagedProps.metadata.currentPage + 1; page <= pagedProps.metadata.totalPages; page++) {
			const result = await this.fetchFn()(request, page, this.pageSize);
			data.update(current => [...current, ...result.properties]);
			props.set(result);
		}

		const completeData = data();
		if (completeData.length > 0) {
			// TODO: improve duplicate logic, by macking it obsolete in the backend by using proper functions
			const existingIds = new Set(completeData.map(item => (item as any)[this.config().idKey]));
			if (completeData.length !== existingIds.size) {
				console.error("DUPLICATES DETECTED: ", completeData.length-existingIds.size);
			}
		}

		
		
		this.loading.set(false);
    }
	protected async loadAll () {
		await this.loadAllPages(this.pagedProperties, this.accumulatedData, this.requestValue());
		if (this.compare()) this.loadAllPages(this.comparePagedProperties, this.compareAccumulatedData, this.requestCompare());
	}


	private getTotalElements(props: PagedProperties<T> | null)  {
		if (!props) return 0;
		return props.metadata.totalElements;
	}

	private filterData(data: T[], filterCategory: keyof T, minFilter: number | null, maxFilter: number | null) {
		let filteredData = data;
		if (!filterCategory) return filteredData;
		if (minFilter) filteredData = filteredData.filter(d => d[filterCategory] as number >= minFilter);
		if (maxFilter) filteredData = filteredData.filter(d => d[filterCategory] as number <= maxFilter);
		return filteredData;
	}
}
