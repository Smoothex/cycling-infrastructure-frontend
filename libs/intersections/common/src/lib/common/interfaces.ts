import { FeatureCollection, LineString, Polygon, Position, Geometry } from 'geojson';
import { calculateMidPoint } from '@simra/intersections-common';
import { ETrafficTimes, EWeekDays, EYear } from '@simra/common-models';
import { Observable } from 'rxjs';


export interface PagedGeoResponse<T extends Geometry> {
    metadata: {
        totalElements: number;
        totalPages: number;
        currentPage: number;
    };
    geoData: FeatureCollection<T>;
}

interface linkLabelValue {
    label: string; 
    value: string;
}

export interface BaseRow {
    id: number;
    midPoint: Position;
}

interface BaseRequest {
    sort?: string;
    page?: number;
    size?: number;
    weekDay?: EWeekDays[];
    trafficTime?: ETrafficTimes[];
    year?: EYear[];
}


export interface IntersectionNodeAggregateRequest extends BaseRequest {
    trafficSignalClusterId?: number; 
    numberOfRides?: number;
    region?: string; 
    streetNames?: string;
}

export interface IntersectionNodeAggregateRow extends BaseRow {
	startOsmId: number;
	endOsmId: number;
	trafficSignalClusterId: number;
    trafficSignalClusterLink: linkLabelValue;
    clusterStartEndLink: linkLabelValue;
    weekDay: EWeekDays;
    trafficTime: ETrafficTimes;
    year: EYear;
    startName: string;
    endName: string;
    streetNames: string;
	numberOfRides: number;
	medianLength: number;
	medianDuration: number;
	medianSpeed: number;
	maxWaitingTime: number;
	medianWaitingTime: number;
}

export interface IntersectionNodeRow extends BaseRow {
	startOsmId: number;
	endOsmId: number;
	trafficSignalClusterId: number;
	rideId: number;
	startTime: Date;
	endTime: Date;
	length: number;
	speed: number;
	duration: number;
    waitingTime: number;
	streetNames: string;
}


export interface IntersectionEdgeAggregateRequest extends BaseRequest {
    numberOfRides?: number;
    region?: string; 
    name?: string;
    weekDay?: EWeekDays[];
    trafficTime?: ETrafficTimes[];
    year?: EYear[];
}

export interface IntersectionEdgeAggregateRow extends BaseRow {
	osmId: number;
	prevOsmId: number;
	nextOsmId: number;
    prevOsmNextLink: linkLabelValue;
    weekDay: EWeekDays;
    trafficTime: ETrafficTimes;
    year: EYear;
    name: string;
	numberOfRides: number;
	medianLength: number;
	medianDuration: number;
	medianSpeed: number;
	maxWaitingTime: number;
	medianWaitingTime: number;
}

export interface IntersectionEdgeRow extends BaseRow {
	osmId: number;
	prevOsmId: number;
    nextOsmId: number;
	rideId: number;
	startTime: Date;
	endTime: Date;
	length: number;
	speed: number;
	duration: number;
    waitingTime: number;
	name: string;
}


export interface RegionAggregateRequest {
    region?: string;
}

export interface RegionAggregateRow {
    name: string; 
    numberOfRides: number; 
    nodeMedianWaitingTime: number;
    length: number;
    nodeWaitingPerKm: number;
    nodeMedianWaitingPerKm: number;
    edgeWaitingPerKm: number;
    edgeMedianWaitingPerKm: number;
}


export type HeaderFilter<T> =
  | NumberHeaderFilter<T>
  | AutocompleteHeaderFilter<T>
  | EnumHeaderFilter<T>;

export interface BaseHeaderFilter<T, K extends keyof T> {
  field: K;
}

export interface NumberHeaderFilter<T, K extends keyof T = keyof T>
  extends BaseHeaderFilter<T, K> {
  dataType: 'number';
  step: number;
  min: number;
  default?: number;
}

export interface AutocompleteHeaderFilter<T, K extends keyof T = keyof T>
  extends BaseHeaderFilter<T, K> {
  dataType: 'autocomplete';
  fetchFunction: (query: string) => Observable<string[]>;
}

export interface EnumHeaderFilter<
  T,
  K extends keyof T = keyof T,
  E = any
> extends BaseHeaderFilter<T, K> {
  dataType: 'enum';
  enum: E;
  translationMap: any; // Record<string, string>;
  default?: E[keyof E] | E[keyof E][];
}

export interface ListColumn<T, K extends keyof T = keyof T> {
  field: K & string;
  header: string;
  sortable?: boolean;
  display?: 'decimal' | 'link' | 'enum' | 'zoomOnLine' | 'date';
  translationMap?: any; // Record<string, string>;
  headerFilter?: HeaderFilter<T>;
}


export function mapIntersectionNodeAggregateToRows(fc: FeatureCollection<LineString>): IntersectionNodeAggregateRow[] {
    return fc.features.map(f => ({
        startOsmId: f.properties?.['startOsmId'],
        endOsmId: f.properties?.['endOsmId'],
        trafficSignalClusterId: f.properties?.['trafficSignalClusterId'],
        trafficSignalClusterLink: {label: String(f.properties?.['trafficSignalClusterId']), value: `/intersections/node/${f.properties?.['trafficSignalClusterId']}`},
        clusterStartEndLink: {label: `${f.properties?.['startOsmId']}-${f.properties?.['endOsmId']}`, value: `/intersections/node/${f.properties?.['trafficSignalClusterId']}/${f.properties?.['startOsmId']}/${f.properties?.['endOsmId']}`},
        weekDay : f.properties?.['weekDay'],
        trafficTime: f.properties?.['trafficTime'],
        year: f.properties?.['year'],
        startName: f.properties?.['startName'],
        endName: f.properties?.['endName'],
        streetNames: f.properties?.['streetNames'],
        id: f.properties?.['id'],
        numberOfRides: f.properties?.['numberOfRides'],
        medianLength: f.properties?.['medianLength'],
        medianDuration: f.properties?.['medianDuration'],
        medianSpeed: f.properties?.['medianSpeed'],
        maxWaitingTime: f.properties?.['maxWaitingTime'],
        medianWaitingTime: f.properties?.['medianWaitingTime'],
        midPoint: calculateMidPoint(f.geometry)
    }));
}

export function mapIntersectionNodeToRows(fc: FeatureCollection<LineString>): IntersectionNodeRow[] {
    return fc.features.map(f => ({
        id: f.properties?.['id'],
        startOsmId: f.properties?.['startOsmId'],
        endOsmId: f.properties?.['endOsmId'],
        trafficSignalClusterId: f.properties?.['trafficSignalClusterId'],
        rideId: f.properties?.['rideId'],
        startTime: f.properties?.['startTime'],
        endTime: f.properties?.['endTime'],
        length: f.properties?.['length'],
        speed: f.properties?.['speed'],
        duration: f.properties?.['duration'],
        waitingTime: f.properties?.['waitingTime'],
        streetNames: f.properties?.['streetNames'],
        midPoint: calculateMidPoint(f.geometry)
    }));
}


export function mapIntersectionEdgeAggregateToRows(fc: FeatureCollection<LineString>): IntersectionEdgeAggregateRow[] {
    return fc.features.map(f => ({
        osmId: f.properties?.['osmId'],
        prevOsmId: f.properties?.['prevOsmId'],
        nextOsmId: f.properties?.['nextOsmId'],
        prevOsmNextLink: {label: `${f.properties?.['prevOsmId']}-${f.properties?.['osmId']}-${f.properties?.['nextOsmId']}`, value: `/intersections/edge/${f.properties?.['prevOsmId']}/${f.properties?.['osmId']}/${f.properties?.['nextOsmId']}`},
        weekDay : f.properties?.['weekDay'],
        trafficTime: f.properties?.['trafficTime'],
        year: f.properties?.['year'],
        name: f.properties?.['name'],
        id: f.properties?.['id'],
        numberOfRides: f.properties?.['numberOfRides'],
        medianLength: f.properties?.['medianLength'],
        medianDuration: f.properties?.['medianDuration'],
        medianSpeed: f.properties?.['medianSpeed'],
        maxWaitingTime: f.properties?.['maxWaitingTime'],
        medianWaitingTime: f.properties?.['medianWaitingTime'],
        midPoint: calculateMidPoint(f.geometry)
    }));
}

export function mapIntersectionEdgeToRows(fc: FeatureCollection<LineString>): IntersectionEdgeRow[] {
    return fc.features.map(f => ({
        id: f.properties?.['id'],
        osmId: f.properties?.['osmId'],
        prevOsmId: f.properties?.['prevOsmId'],
        nextOsmId: f.properties?.['nextOsmId'],
        rideId: f.properties?.['rideId'],
        startTime: f.properties?.['startTime'],
        endTime: f.properties?.['endTime'],
        length: f.properties?.['length'],
        speed: f.properties?.['speed'],
        duration: f.properties?.['duration'],
        waitingTime: f.properties?.['waitingTime'],
        name: f.properties?.['name'],
        midPoint: calculateMidPoint(f.geometry)
    }));
}

export function mapIntersectionRegionAggregateToRows(fc: FeatureCollection<Polygon>): RegionAggregateRow[] {
    return fc.features.map(f => ({
        name: f.properties?.['name'],
        numberOfRides: f.properties?.['number_of_rides'],
        nodeMedianWaitingTime: f.properties?.['node_median_waiting_time'],
        length: f.properties?.['length_km'],
        nodeWaitingPerKm: f.properties?.['node_waiting_s_per_km'],
        nodeMedianWaitingPerKm: f.properties?.['node_median_waiting_s_per_km'],
        edgeWaitingPerKm: f.properties?.['edge_waiting_s_per_km'],
        edgeMedianWaitingPerKm: f.properties?.['edge_median_waiting_s_per_km'],
    }));
}


