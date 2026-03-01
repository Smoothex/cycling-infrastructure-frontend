import { FeatureCollection, LineString, Polygon, Position, Geometry } from 'geojson';
import { calculateMidPoint } from '@simra/intersections-common';
import { ETrafficTimes, EWeekDays, EYear } from '@simra/common-models';
import { Observable } from 'rxjs';
import { centroid } from '@turf/turf';


export interface PagedGeoResponse<T extends Geometry> {
    metadata: {
        totalElements: number;
        totalPages: number;
        currentPage: number;
    };
    geoData: FeatureCollection<T>;
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
    startDate?: Date;
    endDate?: Date;
}

interface PrecomputedRequest {
    weekDay?: EWeekDays;
    trafficTime?: ETrafficTimes;
    year?: EYear;
}

export interface MetricRequest extends PrecomputedRequest {
    numberOfRides: number;
}

interface PageableMetricRequest extends MetricRequest {
    sort?: string;
    page?: number;
    size?: number;
}


export interface NodePageableMetricRequest extends PageableMetricRequest {
    trafficSignalClusterId?: number; 
    region?: string; 
    streetNames?: string;
}

export interface NodeMetricRow extends IntersectionRow {
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

export interface NodeRow extends IntersectionRow {
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


export interface EdgePageableMetricRequest extends PageableMetricRequest {
    region?: string; 
    name?: string;
    osmId?: number;
}

export interface EdgeMetricRow extends IntersectionRow {
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

export interface EdgeRow extends IntersectionRow {
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


export interface RegionMetricRequest extends MetricRequest {
    regionId?: number;
}

export interface RegionMetricRow extends IntersectionRow {
    regionIdLink: linkLabelValue;
    name: string;
    adminLevel: number; 
    numberOfRides: number; 
    nodeMedianWaitingTime: number;
    length: number;
    nodeWaitingSPerKm: number;
    edgeWaitingSPerKm: number;
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


export function mapNodeMetricToRows(fc: FeatureCollection<LineString>): NodeMetricRow[] {
    return fc.features.map(f => ({
        startOsmId: f.properties?.['startOsmId'],
        endOsmId: f.properties?.['endOsmId'],
        trafficSignalClusterId: f.properties?.['trafficSignalClusterId'],
        trafficSignalClusterLink: {label: String(f.properties?.['trafficSignalClusterId']), value: `/intersections/trafficSignalCluster/${f.properties?.['trafficSignalClusterId']}`},
        clusterStartEndLink: {label: `${f.properties?.['startOsmId']}-${f.properties?.['endOsmId']}`, value: `/intersections/base/${f.properties?.['id']}`},
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

export function mapNodeToRows(fc: FeatureCollection<LineString>): NodeRow[] {
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


export function mapEdgeMetricToRows(fc: FeatureCollection<LineString>): EdgeMetricRow[] {
    return fc.features.map(f => ({
        osmId: f.properties?.['osmId'],
        prevOsmId: f.properties?.['prevOsmId'],
        nextOsmId: f.properties?.['nextOsmId'],
        prevOsmNextLink: {label: `${f.properties?.['prevOsmId']}-${f.properties?.['osmId']}-${f.properties?.['nextOsmId']}`, value: `/intersections/base/${f.properties?.['id']}`},
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

export function mapEdgeToRows(fc: FeatureCollection<LineString>): EdgeRow[] {
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

export function mapRegionMetricToRows(fc: FeatureCollection<Polygon>): RegionMetricRow[] {
    return fc.features.map(f => ({
        id: f.properties?.['regionId'],
        regionIdLink: {label: f.properties?.['regionId'], value: `/intersections/regions/${f.properties?.['regionId']}`},
        name: f.properties?.['name'],
        adminLevel: f.properties?.['adminLevel'],
        numberOfRides: f.properties?.['numberOfRides'],
        nodeMedianWaitingTime: f.properties?.['nodeMedianWaitingTime'],
        length: f.properties?.['length'],
        nodeWaitingSPerKm: f.properties?.['nodeWaitingSPerKm'],
        edgeWaitingSPerKm: f.properties?.['edgeWaitingSPerKm'],
        midPoint: centroid(f).geometry.coordinates
    }));
}