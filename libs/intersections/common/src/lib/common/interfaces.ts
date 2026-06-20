import { FeatureCollection, Position, Geometry } from 'geojson';
import { ETrafficTimes, EWeekDays, EYear } from '@simra/common-models';
import { Observable } from 'rxjs';
import { Signal, WritableSignal } from '@angular/core';
import { ChartData, ChartOptions, ChartType } from 'chart.js';

type PagedResponse<K extends string, V> = {
    metadata: {
        totalElements: number;
        totalPages: number;
        currentPage: number;
    };
} & Record<K, V>;
export type PagedGeoResponse<T extends Geometry> = PagedResponse<"geoData", FeatureCollection<T>>;
export type PagedIds = PagedResponse<"ids", number[]>;
export type PagedProperties<T> = PagedResponse<"properties", T[]>;

export interface IdListRequest {
    id?: number;
    page: number;
    size: number;
}

export interface zoomTarget {
    lng: number;
    lat: number;
    zoom: number;
    sourceId?: string;
    id?: number;
}
export interface linkLabelValueMap extends linkLabelValue {
    params: zoomTarget;
}
export interface linkLabelValue {
    label: string; 
    value: string;
    params?: object;
}

export interface IntersectionRow {
    id: number;
    midPoint: Position;
}

export interface BaseRequest {
    id: number;
}

export interface StartEndDateRequest {
    startDate: number;
    endDate: number;
}

export interface PrecomputedRequest {
    weekDay: EWeekDays;
    trafficTime: ETrafficTimes;
    year: EYear;
}

export interface MetricRequest extends PrecomputedRequest {
    numberOfRides: number;
}

export interface PageableRequest {
    sort?: string;
    page: number;
    size: number;
}
export interface PrecomputedPageableRequest extends PageableRequest, PrecomputedRequest {} 

export interface PageableMetricRequest extends MetricRequest, PageableRequest {}

export interface Base<TDate = Date>  {
    id: number;
	rideId: number;
	length: number;
	speed: number;
    medianRideSpeed: number;
	duration: number;
    waitingTime: number;
	startTime: TDate;
	endTime: TDate;
    trafficTime: ETrafficTimes;
    weekDay: EWeekDays;
    year: EYear;
}
export type RawBase = Base<string> 
export function cleanBase (data: RawBase[]) : Base[] {
    return data.map((el) => ({
        ...el,
        startTime: new Date(el.startTime),
        endTime: new Date(el.endTime)
    }));
}

export interface AggregatedResult {
    weekDay: EWeekDays;
    trafficTime: ETrafficTimes;
    year: EYear;
}
export interface BaseMetric extends AggregatedResult {
    id: number;
	numberOfRides: number;
	avgLength: number;
	avgDuration: number;
	avgSpeed: number;
	maxWaitingTime: number;
    sumWaitingTime: number;
	avgWaitingTime: number;
    stopRate: number;
    avgWaitingTimeWhenStopped: number;
}

interface NodeRequest {
    trafficSignalClusterId?: number;
    startValhallaEdgeId?: number;
    endValhallaEdgeId?: number;
    regionId?: number;
}
export interface NodePageableRequestPrecomputed extends PrecomputedPageableRequest, NodeRequest {}
export interface NodePageableRequestStartEndDate  extends PageableRequest, StartEndDateRequest, NodeRequest {}
export interface NodePageableMetricRequest extends PageableMetricRequest, NodePageableRequestPrecomputed {
    region?: string;
    streetNames?: string;
}

export interface NodeMetric extends BaseMetric, NodeSpecifics {}
export interface NodeMetricRow extends IntersectionRow, BaseMetric, NodeSpecifics {
    trafficSignalClusterLink: linkLabelValue;
    segmentLink: linkLabelValue;
    mapLinktrafficSignalCluster: linkLabelValueMap;
    mapLinkSegment: linkLabelValueMap;
}

interface NodeSpecifics {
    startValhallaEdgeId: number | undefined;
    endValhallaEdgeId: number | undefined;
	trafficSignalClusterId: number;
    startName: string;
    endName: string;
    streetNames: string;
    startOsmId: number | undefined;
	endOsmId: number | undefined;
}

export interface Node extends Base, NodeSpecifics {}

export interface NodeRow extends IntersectionRow, Node {
    nodeLink: linkLabelValue
}


interface EdgeRequest {
    osmId?: number;
    valhallaEdgeId?: number;
	prevValhallaEdgeId?: number;
    nextValhallaEdgeId?: number;
    regionId?: number;
}
export interface EdgePageableRequestPrecomputed extends PrecomputedPageableRequest, EdgeRequest {}
export interface EdgePageableRequestStartEndDate extends PageableRequest, StartEndDateRequest, EdgeRequest {}
export interface EdgePageableMetricRequest extends PageableMetricRequest, EdgePageableRequestPrecomputed {
    region?: string;
    name?: string;
}

export interface EdgeMetric extends BaseMetric, EdgeSpecifics {}
export interface EdgeMetricRow extends IntersectionRow, BaseMetric, EdgeSpecifics {
    segmentLink: linkLabelValue;
    osmLink: linkLabelValue;
    mapLinkOsm: linkLabelValueMap;
    mapLinkSegment: linkLabelValueMap;
}

interface EdgeSpecifics {
	valhallaEdgeId: number | undefined;
	prevValhallaEdgeId: number | undefined;
    nextValhallaEdgeId: number | undefined;
	name: string;
    osmId: number | undefined;
	prevOsmId: number | undefined;
    nextOsmId: number | undefined;
}

export interface Edge extends Base, EdgeSpecifics {}

export interface EdgeRow extends IntersectionRow, Edge {
    edgeLink: linkLabelValue
}

export interface RegionCompleteRequest extends MetricRequest {
    adminLevel: number;
}
export interface RegionPageableRequest extends PageableMetricRequest {
    regionId?: number;
    adminLevel?: number;
}


export interface RegionMetricData  {
    name: string;
    adminLevel: number;

    length: number;
    duration: number;

    nodesPerKm : number;

    numberOfNodes: number;
    nodeWaitingTime: number;
    nodeAvgWaitingTime: number;
    nodeAvgWaitingTimeWhenStopped: number;
    nodeStopRate: number;
    nodeWaitingSPerKm: number;
    nodeWaitingRate: number;
    nodeLength: number;
    nodeDuration: number;

    numberOfEdges: number;
    edgeWaitingTime: number;
    edgeAvgWaitingTime: number;
    edgeAvgWaitingTimeWhenStopped: number;
    edgeStopRate: number;
    edgeWaitingSPerKm: number;
    edgeWaitingRate: number;

    weekDay: EWeekDays;
    trafficTime: ETrafficTimes;
    year: EYear; 
}

export interface RegionMetric extends RegionMetricData {
    id: number;
    numberOfRides: number;
}
export interface RegionMetricRow extends IntersectionRow, RegionMetric {
    regionIdLink: linkLabelValue;
    mapLink: linkLabelValueMap;
}

export interface RideRegionMetric<TDate = Date> extends RegionMetricData  {
    rideId: number;
    regionId: number;
    startTime: TDate;
    medianRideSpeed: number;
}
export type RawRideRegionMetric = RideRegionMetric<string> 
export function cleanRideRegionMetric(data: RawRideRegionMetric[]) : RideRegionMetric[] {
    return data.map((el) => ({
        ...el,
        startTime: new Date(el.startTime)
    }));
}


export interface NumberFilterConfig {
  step: number;
  min: number;
  default?: number;
}

export interface AutocompleteFilterConfig {
  fetchFunction: (query: string) => Observable<string[]>;
}

export interface EnumFilterConfig<E = any> {
  enum: E;
  default?: E[keyof E] | E[keyof E][];
}

export interface FilterMapping<E = any> {
  autocomplete: AutocompleteFilterConfig;
  enum: EnumFilterConfig<E>;
  number: NumberFilterConfig;

  date: never;
  link: never; 
  text: never;
  zoomOnLine: never;
}

interface ListColumnBase<T> {
  field: keyof T & string;
  header: string;
  tooltip?: string;
  sortable: boolean;
  translationMap?: any;
}
export type ListColumn<T> = {
  [K in keyof FilterMapping]: ListColumnBase<T> & {
    display: K;
    headerFilter?: FilterMapping[K];
  }
}[keyof FilterMapping];



export enum ECardMode {
    PRECOMPUTED = 'PRECOMPUTED',
    REALTIME = 'REALTIME',
}

export const DATE_FILTER_DEFAULTS = {
    mode: ECardMode.PRECOMPUTED,
    year: EYear.ALL,
    weekDays: EWeekDays.ALL_WEEK,
    trafficTime: ETrafficTimes.ALL_DAY,
    startTime: new Date('1970-01-01T00:00:00'),
    endTime: new Date('1970-01-01T23:59'),
    getDatetime: () => [new Date('2019-01-01T00:00'), new Date()]
};


export interface SelectableProperty<T> {
    value: keyof T; 
    label: string
}
export interface ChartConfig<T> {
    selectableProperties: SelectableProperty<T>[];
    defaultProperty: keyof T;
    defaultProperty2: keyof T;
    aggregationLabel : string;
    isAggregated?: boolean;
    canCompare?: boolean;
    idKey: keyof T & string;
}

interface NumberSetting {
    type: "number";
    value: WritableSignal<number | null>;
    min?: number;
    step?: number;
}
interface SelectSetting {
    type: "select";
    value: WritableSignal<any>;
    options: ({value: any; label: any})[];
}
interface BooleanSetting {
    type: "boolean";
    value: WritableSignal<boolean>;
}
interface Setting {
    label: string;
    props: NumberSetting | SelectSetting | BooleanSetting;
}
export interface SettingGroup {
    group: string;
    items: Setting[];
}

export type TimeCategory = "trafficTime" | "weekDay" | "year";
export const TimeCategoryLabels: Record<TimeCategory, string> = {
    trafficTime: "Traffic Time",
    weekDay: "Week Day",
    year: "Year",
}
export function recordToOptions <T extends string | number | symbol> (record: Record<T, string>) {
    return Object.entries(record).map(([value, label]) => ({
		label: label,
		value: value
	}));
}

export interface ChartFilter<T> {
    min: WritableSignal<number | null>;
    max: WritableSignal<number | null>;
    onProperty: WritableSignal<keyof T>;
    onPropertyLabel: Signal<string>;
    selectableProperties: ({value: keyof T; label: string})[];
    totalElements: Signal<number>;
    excludedElements: Signal<number>;
    timeCategory?: WritableSignal<TimeCategory>;
    timeCategoryValue?: WritableSignal<EYear | EWeekDays | ETrafficTimes>;
    timeCategoryCompare?: WritableSignal<EYear | EWeekDays | ETrafficTimes>;
}

export interface ChartComplete {
    chartType: ChartType;
    data: ChartData;
    options: ChartOptions;
}