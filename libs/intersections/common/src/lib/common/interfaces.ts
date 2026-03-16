import { FeatureCollection, LineString, Polygon, Position, Geometry } from 'geojson';
import { calculateMidPoint } from '@simra/intersections-common';
import { ETrafficTimes, EWeekDays, EYear } from '@simra/common-models';
import { Observable } from 'rxjs';
import { centroid } from '@turf/turf';

export type PagedResponse<K extends string, V> = {
    metadata: {
        totalElements: number;
        totalPages: number;
        currentPage: number;
    };
} & Record<K, V>;
export interface PagedGeoResponse<T extends Geometry> extends PagedResponse<"geoData", FeatureCollection<T>> {}
export interface PagedIdList extends PagedResponse<"ids", number[]> {}

export interface IdListRequest {
    id?: number;
    page: number;
    size: number;
}


export interface linkLabelValue {
    label: string; 
    value: string;
}

export interface IntersectionRow {
    id: number;
    midPoint: Position;
}

export interface BaseRequest extends StartEndDateRequest, PrecomputedRequest {
    id: number;
    regionId?: number;
}

interface StartEndDateRequest {
    startDate?: number;
    endDate?: number;
}

interface PrecomputedRequest {
    weekDay?: EWeekDays;
    trafficTime?: ETrafficTimes;
    year?: EYear;
}

export interface MetricRequest extends PrecomputedRequest {
    numberOfRides: number;
}

export interface PageableMetricRequest extends MetricRequest {
    sort?: string;
    page?: number;
    size?: number;
}

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


export interface BaseMetric {
    weekDay: EWeekDays;
    trafficTime: ETrafficTimes;
    year: EYear;
	numberOfRides: number;
	medianLength: number;
	medianDuration: number;
	medianSpeed: number;
	maxWaitingTime: number;
	medianWaitingTime: number;
}


export interface NodePageableMetricRequest extends PageableMetricRequest {
    trafficSignalClusterId?: number; 
    region?: string; 
    streetNames?: string;
}

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

export interface NodeRow extends IntersectionRow, Node {}


export interface EdgePageableMetricRequest extends PageableMetricRequest {
    region?: string; 
    name?: string;
    osmId?: number;
}

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

export interface EdgeRow extends IntersectionRow, Edge {}

export interface RegionMetricRequest extends PageableMetricRequest {
    regionId?: number;
    adminLevel?: number;
}

export interface RegionMetric<TEnumT = ETrafficTimes, TEnumW = EWeekDays, TEnumY = EYear>  {
    id: number;
    name: string;
    adminLevel: number;
    numberOfEdges: number;
    numberOfNodes: number;
    numberOfRides: number; 
    nodeMedianWaitingTime: number;
    length: number;
    nodeWaitingSPerKm: number;
    edgeWaitingSPerKm: number;
    nodesPerKm : number;
    weekDay: TEnumW;
    trafficTime: TEnumT;
    year: TEnumY; 
}
export type RawRegionMetric = RegionMetric<string, string, number>
export function cleanRegionMetric(data: RawRegionMetric[]) : RegionMetric[] {
    return data.map((el) => ({
        ...el,
        nodesPerKm: el.numberOfNodes / el.length,
        trafficTime: el.trafficTime as ETrafficTimes,
        weekDay: el.weekDay as EWeekDays,
        year: el.year.toString() as EYear
    }));
}

export interface RegionMetricRow extends IntersectionRow, RegionMetric {
    regionIdLink: linkLabelValue;
}

export interface RideRegionMetric<TEnumT = ETrafficTimes, TEnumW = EWeekDays, TEnumY = EYear>  {
    rideId: number;
    regionId: number;
    name: string;
    adminLevel: number; 
    numberOfEdges: number;
    numberOfNodes: number;
    nodeMedianWaitingTime: number;
    length: number;
    nodeWaitingSPerKm: number;
    edgeWaitingSPerKm: number;
    nodesPerKm : number;
    weekDay: TEnumW;
    trafficTime: TEnumT;
    year: TEnumY; 
}
export type RawRideRegionMetric = RideRegionMetric<string, string, number> 
export function cleanRideRegionMetric(data: RawRideRegionMetric[]) : RideRegionMetric[] {
    return data.map((el) => ({
        ...el,
        nodesPerKm: el.numberOfNodes / el.length,
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
    labels: Record<keyof T, string>;
    selectableProperties: (keyof T)[];
    defaultProperty: keyof T;
    defaultProperty2: keyof T;
}

