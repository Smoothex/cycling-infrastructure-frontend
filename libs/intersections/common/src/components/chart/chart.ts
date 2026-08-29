import { Component, input, computed, signal, effect, untracked, linkedSignal, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';

import { Card } from 'primeng/card';
import { Button } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { Skeleton } from 'primeng/skeleton';
import {
	PageableRequest,
	PrecomputedRequest,
	ChartConfig,
	ChartFilter,
	TimeCategory,
	ScrollProperties
} from '../../lib/common/interfaces';
import { ChartDataHandler } from './chartDataHandler';
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
export class IntersectionChartComponent<T, R extends PageableRequest | PrecomputedRequest> {
	public readonly header = input.required<string>();
    public readonly config = input.required<ChartConfig<T>>();

	public readonly request = input.required<R | null>();
	public readonly fetchFn = input.required<(req: R, lastId: number | undefined, pageSize: number) => Promise<ScrollProperties<T>>>();
	public readonly countFn = input.required<(req: R) => Promise<number>>();

	private readonly translate = inject(TranslateService);
    private readonly PAGE_SIZE = 1000;

	protected readonly primaryDataset = computed(() => {
		const fetch = this.fetchFn();
		const count = this.countFn();
		return new ChartDataHandler<T, R>(fetch, count, this.PAGE_SIZE);
	});
    protected readonly compareDataset = computed(() => {
		const fetch = this.fetchFn();
		const count = this.countFn();
		return new ChartDataHandler<T, R>(fetch, count, this.PAGE_SIZE);
	});

	protected filterMin = signal<number | null>(null);
    protected filterMax = signal<number | null>(null);
    protected filterProperty = linkedSignal(() => this.config().defaultProperty2);
    protected propertyChart = linkedSignal(() => this.config().defaultProperty);
    
    // Category setups
    protected timeCategory = signal<TimeCategory>("year");
    protected isCompareMode = computed(() => this.config().isAggregated ?? false);

    // Dynamic Category Signals
    protected timeCategoryYear = linkedSignal<EYear>(() => (this.request() as any)?.year ?? EYear.ALL);
    protected timeCategoryYearCompare = signal<EYear>(EYear.Y2020);
    protected timeCategoryWeekDay = linkedSignal<EWeekDays>(() => (this.request() as any)?.weekDay ?? EWeekDays.ALL_WEEK);
    protected timeCategoryWeekDayCompare = signal<EWeekDays>(EWeekDays.WEEKEND);
    protected timeCategoryTrafficTime = linkedSignal<ETrafficTimes>(() => (this.request() as any)?.trafficTime ?? ETrafficTimes.ALL_DAY);
    protected timeCategoryTrafficTimeCompare = signal<ETrafficTimes>(ETrafficTimes.MID_DAY);

    protected currentCategoryValues = computed(() => {
        const mappings = {
            year: { value: this.timeCategoryYear, compare: this.timeCategoryYearCompare },
            weekDay: { value: this.timeCategoryWeekDay, compare: this.timeCategoryWeekDayCompare },
            trafficTime: { value: this.timeCategoryTrafficTime, compare: this.timeCategoryTrafficTimeCompare }
        };
        return mappings[this.timeCategory()];
    });

    // Requests resolution
    public readonly requestValue = computed(() => this.overrideTimeCategoryRequest(this.request(), this.currentCategoryValues().value()));
    public readonly requestCompare = computed(() => this.overrideTimeCategoryRequest(this.request(), this.currentCategoryValues().compare()));

    // Processed Data Pipelines
    protected readonly primaryFilteredData = computed(() => this.applyLocalFilters(this.primaryDataset().accumulatedData()));
    protected readonly compareFilteredData = computed(() => this.applyLocalFilters(this.compareDataset().accumulatedData()));
    
    protected readonly showScatter = computed(() => this.primaryDataset().accumulatedData().length < 300);
    protected readonly isLoading = computed(() => this.primaryDataset().loading() || this.compareDataset().loading());

    protected readonly label = computed(() => this.config().selectableProperties.find(p => p.value === this.propertyChart())?.label ?? "");
    protected readonly compareLabel = computed(() => this.compareConfig()?.selectableProperties.find(p => p.value === this.compareProperty())?.label ?? "");

	
	protected chartFilter = computed<ChartFilter<T>>(() => ({
        min: this.filterMin,
        max: this.filterMax,
        onProperty: this.filterProperty,
        onPropertyLabel: computed(() => this.config().selectableProperties.find(p => p.value === this.filterProperty())?.label ?? ""),
        totalElements: computed(() => this.primaryDataset().accumulatedData().length),
        excludedElements: computed(() => this.primaryDataset().accumulatedData().length - this.primaryFilteredData().length),
        selectableProperties: this.config().selectableProperties,
        ...(this.isCompareMode() && {
            timeCategory: this.timeCategory,
            timeCategoryValue: this.currentCategoryValues().value,
            timeCategoryCompare: this.currentCategoryValues().compare
        })
    }));

	constructor() {
        effect(() => {
            const req = this.requestValue();
            const reqComp = this.requestCompare();
            if (!req || !reqComp) return;

            untracked(() => {
                this.primaryDataset().resetAndFetchFirstBatch(req);
                this.primaryDataset().initializeCount(req);
                
                if (this.isCompareMode()) {
                    this.compareDataset().resetAndFetchFirstBatch(reqComp);
                    this.compareDataset().initializeCount(reqComp);
                }
            });
        });
    }

	protected async loadAllData(): Promise<void> {
        await this.primaryDataset().loadRemainingPages(this.requestValue());
        if (this.isCompareMode()) {
            await this.compareDataset().loadRemainingPages(this.requestCompare());
        }
    }

    private overrideTimeCategoryRequest(baseReq: R | null, value: any): R | null {
        if (!baseReq) return null;
        const category = this.timeCategory();
        return (category in baseReq) ? { ...baseReq, [category]: value } : baseReq;
    }

    private applyLocalFilters(data: T[]): T[] {
        const category = this.filterProperty();
        const min = this.filterMin();
        const max = this.filterMax();
        if (!category) return data;
        
        return data.filter(d => {
            const val = d[category] as number;
            return (min === null || val >= min) && (max === null || val <= max);
        });
    }

    // Comparison Mappings & Generation
    protected readonly compareConfig = computed<ChartConfig<Record<string, any>> | null>(() => {
        const config = this.config();
        if (!this.isCompareMode() || !config?.canCompare) return null;

        const translation = TimeCatergoryLabelTranslations[this.timeCategory()];
        const c1 = this.currentCategoryValues().value() as string;
        const c2 = this.currentCategoryValues().compare() as string;

        const l1 = this.translate.instant(translation[c1].label);
        const l2 = this.translate.instant(translation[c2].label);

        const options: { value: string; label: string }[] = [];
        config.selectableProperties.forEach(option => {
            const propStr = String(option.value);
            options.push({ label: `${l1}: ${option.label}`, value: `${c1}${propStr}` });
            options.push({ label: `${l2}: ${option.label}`, value: `${c2}${propStr}` });
            options.push({ label: `Change ${l1} to ${l2}: ${option.label}`, value: `${c2}${c1}${propStr}` });
        });

        return {
            selectableProperties: options,
            defaultProperty: `${c2}${c1}${String(config.defaultProperty)}`,
            defaultProperty2: `${c2}${c1}${String(config.defaultProperty2)}`,
            aggregationLabel: config.aggregationLabel,
            isAggregated: config.isAggregated,
            idKey: config.idKey as string
        };
    });

    protected readonly compareProperty = linkedSignal(() => this.compareConfig()?.defaultProperty || "");

    protected readonly mergedCompareData = computed<Record<string, any>[]>(() => {
        const config = this.config();
        if (!this.isCompareMode() || !config?.canCompare) return [];

        const idKey = config.idKey as string;
        const c1 = this.currentCategoryValues().value() as string;
        const c2 = this.currentCategoryValues().compare() as string;
        const segmentMap = new Map<number | string, Record<string, any>>();

        this.primaryFilteredData().forEach((item: any) => {
            const id = item[idKey];
            const entry: any = { [idKey]: id };
            config.selectableProperties.forEach(p => entry[`${c1}${String(p.value)}`] = item[p.value]);
            segmentMap.set(id, entry);
        });

        this.compareFilteredData().forEach((item: any) => {
            const id = item[idKey];
            const entry = segmentMap.get(id);
            if (entry) {
                config.selectableProperties.forEach(p => entry[`${c2}${String(p.value)}`] = item[p.value]);
            }
        });

        return Array.from(segmentMap.values()).filter(segment => {
            let valid = false;
            config.selectableProperties.forEach(p => {
                const val1 = segment[`${c1}${String(p.value)}`];
                const val2 = segment[`${c2}${String(p.value)}`];
                if (typeof val1 === 'number' && typeof val2 === 'number') {
                    segment[`${c2}${c1}${String(p.value)}`] = val2 - val1;
                    valid = true;
                } else {
                    segment[`${c2}${c1}${String(p.value)}`] = null;
                }
            });
            return valid;
        });
    });
}
