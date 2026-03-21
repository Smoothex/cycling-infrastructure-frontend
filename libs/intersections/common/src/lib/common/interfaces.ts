import { FeatureCollection, LineString, Polygon, Position, Geometry } from 'geojson';
import { calculateMidPoint, getZoomLine, getZoomLineFeature } from '@simra/intersections-common';
import { ETrafficTimes, EWeekDays, EYear } from '@simra/common-models';
import { Observable } from 'rxjs';
import { centroid } from '@turf/turf';
import { ChartOptions, ChartData, ChartType } from 'chart.js';

type PagedResponse<K extends string, V> = {
    metadata: {
        totalElements: number;
        totalPages: number;
        currentPage: number;
    };
} & Record<K, V>;
export interface PagedGeoResponse<T extends Geometry> extends PagedResponse<"geoData", FeatureCollection<T>> {}
export interface PagedIds extends PagedResponse<"ids", number[]> {}
export interface PagedProperties<T> extends PagedResponse<"properties", T[]> {}

export interface IdListRequest {
    id?: number;
    page: number;
    size: number;
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

export interface BaseRequest extends StartEndDateRequest, PrecomputedRequest {
    id: number;
    regionId?: number;
}

export interface StartEndDateRequest {
    startDate?: number;
    endDate?: number;
}

export interface PrecomputedRequest {
    weekDay?: EWeekDays;
    trafficTime?: ETrafficTimes;
    year?: EYear;
}

export interface MetricRequest extends PrecomputedRequest {
    numberOfRides: number;
}

export interface PageableRequest {
    sort?: string;
    page?: number;
    size?: number;
}
export interface PrecomputedPageableRequest extends PageableRequest, PrecomputedRequest {} 

export interface PageableMetricRequest extends MetricRequest, PageableRequest {}

export interface Base<TDate = Date, TEnumT = ETrafficTimes, TEnumW = EWeekDays, TEnumY = EYear>  {
    id: number;
	rideId: number;
	length: number;
	speed: number;
    medianRideSpeed: number;
	duration: number;
    waitingTime: number;
	startTime: TDate;
	endTime: TDate;
    trafficTime: TEnumT;
    weekDay: TEnumW;
    year: TEnumY;
}
export type RawBase = Base<string, string, string, number> 
export function cleanBase (data: RawBase[]) : Base[] {
    return data.map((el) => ({
        ...el,
        startTime: new Date(el.startTime),
        endTime: new Date(el.endTime),
        trafficTime: el.trafficTime as ETrafficTimes,
        weekDay: el.weekDay as EWeekDays,
        year: el.year.toString() as EYear
    }));
}

export interface AggregatedResult {
    weekDay: EWeekDays;
    trafficTime: ETrafficTimes;
    year: EYear;
}
export interface BaseMetric extends AggregatedResult {
	numberOfRides: number;
	medianLength: number;
	medianDuration: number;
	medianSpeed: number;
	maxWaitingTime: number;
	medianWaitingTime: number;
}

export interface NodePageableRequest extends PrecomputedPageableRequest, StartEndDateRequest {
    trafficSignalClusterId?: number;
    startValhallaEdgeId?: number;
    endValhallaEdgeId?: number;
    regionId?: number;
}
export interface NodePageableMetricRequest extends PageableMetricRequest {
    trafficSignalClusterId?: number;
    startValhallaEdgeId?: number;
    endValhallaEdgeId?: number;
    region?: string;
    regionId?: number;
    streetNames?: string;
}

export interface NodeMetric extends BaseMetric, NodeSpecifics {}
export interface NodeMetricRow extends IntersectionRow, BaseMetric, NodeSpecifics {
    trafficSignalClusterLink: linkLabelValue;
    segmentLink: linkLabelValue;
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


export interface EdgePageableRequest extends PrecomputedPageableRequest, StartEndDateRequest {
    osmId?: number;
    valhallaEdgeId?: number;
	prevValhallaEdgeId?: number;
    nextValhallaEdgeId?: number;
    regionId?: number;
}
export interface EdgePageableMetricRequest extends PageableMetricRequest {
    osmId?: number;
    valhallaEdgeId?: number;
	prevValhallaEdgeId?: number;
    nextValhallaEdgeId?: number;
    region?: string;
    regionId?: number;
    name?: string;
}

export interface EdgeMetric extends BaseMetric, EdgeSpecifics {}
export interface EdgeMetricRow extends IntersectionRow, BaseMetric, EdgeSpecifics {
    segmentLink: linkLabelValue;
    osmLink: linkLabelValue;
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

export interface RegionMetricRequest extends PageableMetricRequest {
    regionId?: number;
    adminLevel?: number;
}


export interface RegionMetricData<TEnumT = ETrafficTimes, TEnumW = EWeekDays, TEnumY = EYear>  {
    name: string;
    adminLevel: number;

    length: number;
    duration: number;

    numberOfNodes: number;
    nodeWaitingTime: number;
    nodeMedianWaitingTime: number;
    nodesPerKm : number;
    nodeWaitingRate: number;
    nodeWaitingSPerKm: number;

    numberOfEdges: number;
    edgeWaitingTime: number;
    edgeMedianWaitingTime: number;
    edgeWaitingSPerKm: number;

    weekDay: TEnumW;
    trafficTime: TEnumT;
    year: TEnumY; 
}
export interface RegionMetric<TEnumT = ETrafficTimes, TEnumW = EWeekDays, TEnumY = EYear> extends RegionMetricData<TEnumT, TEnumW, TEnumY> {
    id: number;
    numberOfRides: number;
}
export type RawRegionMetric = RegionMetric<string, string, number>
export function cleanRegionMetric(data: RawRegionMetric[]) : RegionMetric[] {
    return data.map((el) => ({
        ...el,
        trafficTime: el.trafficTime as ETrafficTimes,
        weekDay: el.weekDay as EWeekDays,
        year: el.year.toString() as EYear
    }));
}

export interface RegionMetricRow extends IntersectionRow, RegionMetric {
    regionIdLink: linkLabelValue;
}

export interface RideRegionMetric<TDate = Date, TEnumT = ETrafficTimes, TEnumW = EWeekDays, TEnumY = EYear> extends RegionMetricData<TEnumT, TEnumW, TEnumY>  {
    rideId: number;
    regionId: number;
    startTime: TDate;
}
export type RawRideRegionMetric = RideRegionMetric<string, string, string, number> 
export function cleanRideRegionMetric(data: RawRideRegionMetric[]) : RideRegionMetric[] {
    return data.map((el) => ({
        ...el,
        startTime: new Date(el.startTime),
        trafficTime: el.trafficTime as ETrafficTimes,
        weekDay: el.weekDay as EWeekDays,
        year: el.year.toString() as EYear
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

// 2. Map 'display' types to their respective filter configurations
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

export function mapNodeMetricToRows(fc: FeatureCollection<LineString>): NodeMetricRow[] {
    return fc.features.map(f => {
        const nodeMetricRow = <NodeMetricRow> f.properties;
        nodeMetricRow.trafficSignalClusterLink = { 
            label: `${nodeMetricRow.trafficSignalClusterId}`, 
            value: `/intersections/node/${nodeMetricRow.trafficSignalClusterId}`
        };
        nodeMetricRow.segmentLink = {
            label: `${nodeMetricRow.id}`,
            value: `/intersections/segment/${nodeMetricRow.id}`
        };
        nodeMetricRow.midPoint = calculateMidPoint(f.geometry);
        return nodeMetricRow;
    });
}

export function mapNodeToRows(fc: FeatureCollection<LineString>): NodeRow[] {
    return fc.features.map(f => {
        const node = <NodeRow> f.properties;
        const params = {
            ...getZoomLineFeature(f.geometry),
            id: node.id,
            sourceId: `intersectionNodes-${node.rideId}`
        }
        node.nodeLink = {
            label: `${node.rideId}`, 
            value: '/intersections/map',
            params: params
        }
        node.midPoint = calculateMidPoint(f.geometry);
        return node;
    })
}

export function mapEdgeMetricToRows(fc: FeatureCollection<LineString>): EdgeMetricRow[] {
    return fc.features.map(f => {
        const edgeMetricRow = <EdgeMetricRow> f.properties;
        edgeMetricRow.osmLink = {
            label: edgeMetricRow.osmId ? `${edgeMetricRow.osmId}` : '',
            value: `/intersections/edge/${edgeMetricRow.osmId}`
        };
        edgeMetricRow.segmentLink = {
            label: `${edgeMetricRow.id}`,
            value: `/intersections/segment/${edgeMetricRow.id}`
        };
        edgeMetricRow.midPoint = calculateMidPoint(f.geometry);
        return edgeMetricRow;
    });
}

export function mapEdgeToRows(fc: FeatureCollection<LineString>): EdgeRow[] {
    return fc.features.map(f => {
        const edge = <EdgeRow> f.properties;
        const params = {
            ...getZoomLineFeature(f.geometry),
            id: edge.id,
            sourceId: `intersectionEdges-${edge.rideId}`
        }
        edge.edgeLink = {
            label: `${edge.rideId}`, 
            value: '/intersections/map',
            params: params
        }
        edge.midPoint = calculateMidPoint(f.geometry);
        return edge;
    })
}

export function mapRegionMetricToRows(fc: FeatureCollection<Polygon>): RegionMetricRow[] {
    return fc.features.map(f => {
        const regionMetricRow = <RegionMetricRow> f.properties;
        regionMetricRow.regionIdLink = {
            label: `${regionMetricRow.id}`,
            value: `/intersections/regions/${regionMetricRow.id}`
        };
        regionMetricRow.midPoint = centroid(f).geometry.coordinates;
        return regionMetricRow;
    });
}


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

export interface ChartConfig<T> {
    selectableProperties: ({value: keyof T; label: string})[];
    defaultProperty: keyof T;
    defaultProperty2: keyof T;
}

export interface ChartSpecification {
    type: ChartType;
    data: ChartData;
    options: ChartOptions;
}