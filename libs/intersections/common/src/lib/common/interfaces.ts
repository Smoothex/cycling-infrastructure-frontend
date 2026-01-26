import { FeatureCollection, LineString, Polygon, Position } from 'geojson';
import { calculateMidPoint } from '@simra/intersections-common';

export interface IntersectionNodeAggregateRequest {
    trafficSignalClusterId?: number; 
    count?: number;
    region?: string; 
    streetNames?: string;
}

export interface IntersectionNodeAggregateRow {
    id: number;
	startOsmId: number;
	endOsmId: number;
	trafficSignalClusterId: number;
	clusterStartEndId: string;
	count: number;
	avgLength: number;
	avgDuration: number;
	maxDuration: number;
	avgSpeed: number;
	avgWaitingTime: number;
	maxWaitingTime: number;
	medianWaitingTime: number;
	streetNames: string;
    midPoint: Position;
}

export interface IntersectionNodeRow {
    id: number;
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
    midPoint: Position;
}


export interface IntersectionEdgeAggregateRequest {
    count?: number;
    region?: string; 
    name?: string;
}

export interface IntersectionEdgeAggregateRow {
    exampleId: number;
	osmId: number;
	prevOsmId: number;
	nextOsmId: number;
    prevOsmNextId: string;
    name: string;
	count: number;
	avgLength: number;
	avgDuration: number;
	maxDuration: number;
	avgSpeed: number;
	avgWaitingTime: number;
	maxWaitingTime: number;
	medianWaitingTime: number;
    midPoint: Position;
}

export interface IntersectionEdgeRow {
    id: number;
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
    midPoint: Position;
}


export interface RegionAggregateRequest {
    region?: string;
}

export interface RegionAggregateRow {
    name: string; 
    count: number; 
    nodeMedianWaitingTime: number;
    length: number;
    nodeWaitingPerKm: number;
    nodeMedianWaitingPerKm: number;
    edgeWaitingPerKm: number;
    edgeMedianWaitingPerKm: number;
}


export interface HeaderFilter {
	dataType :  'number' | 'autocomplete';
	field: keyof IntersectionNodeAggregateRequest | keyof IntersectionEdgeAggregateRequest;
}

export interface HeaderFilterNumber extends HeaderFilter {
	dataType: 'number',
	step: number,
	min: number,
    default?: number
}

export interface HeaderFilterAutocomplete extends HeaderFilter {
	dataType: 'autocomplete',
	fetchFunction: any
}

export interface ListColumn<T = any> {
	field: keyof T;
	header: string;
	sortable?: boolean;
	filter?: 'number' | 'text';
	display?: string;
	headerFilter?: HeaderFilterNumber | HeaderFilterAutocomplete;
}


export function mapIntersectionNodeAggregateToRows(fc: FeatureCollection<LineString>): IntersectionNodeAggregateRow[] {
    return fc.features.map(f => ({
        id: f.properties?.['example_id'],
        startOsmId: f.properties?.['start_osm_id'],
        endOsmId: f.properties?.['end_osm_id'],
        trafficSignalClusterId: f.properties?.['traffic_signal_cluster_id'],
        clusterStartEndId: `${f.properties?.['start_osm_id']}-${f.properties?.['end_osm_id']}`,
        count: f.properties?.['count'],
        avgLength: f.properties?.['avg_length'],
        avgDuration: f.properties?.['avg_duration'],
        maxDuration: f.properties?.['max_duration'],
        avgSpeed: f.properties?.['avg_speed'],
        avgWaitingTime: f.properties?.['avg_waiting_time'],
        maxWaitingTime: f.properties?.['max_waiting_time'],
        medianWaitingTime: f.properties?.['median_waiting_time'],
        streetNames: f.properties?.['street_names'],
        midPoint: calculateMidPoint(f.geometry)
    }));
}

export function mapIntersectionNodeToRows(fc: FeatureCollection<LineString>): IntersectionNodeRow[] {
    return fc.features.map(f => ({
        id: f.properties?.['id'],
        startOsmId: f.properties?.['start_osm_id'],
        endOsmId: f.properties?.['end_osm_id'],
        trafficSignalClusterId: f.properties?.['traffic_signal_cluster_id'],
        rideId: f.properties?.['ride_id'],
        startTime: f.properties?.['start_time'],
        endTime: f.properties?.['end_time'],
        length: f.properties?.['length'],
        speed: f.properties?.['speed'],
        duration: f.properties?.['duration'],
        waitingTime: f.properties?.['waiting_time'],
        streetNames: f.properties?.['street_names'],
        midPoint: calculateMidPoint(f.geometry)
    }));
}


export function mapIntersectionEdgeAggregateToRows(fc: FeatureCollection<LineString>): IntersectionEdgeAggregateRow[] {
    return fc.features.map(f => ({
        exampleId: f.properties?.['example_id'],
        osmId: f.properties?.['osm_id'],
        prevOsmId: f.properties?.['prev_osm_id'],
        nextOsmId: f.properties?.['next_osm_id'],
        prevOsmNextId: `${f.properties?.['prev_osm_id']}-${f.properties?.['osm_id']}-${f.properties?.['next_osm_id']}`,
        name: f.properties?.['name'],
        count: f.properties?.['count'],
        avgLength: f.properties?.['avg_length'],
        avgDuration: f.properties?.['avg_duration'],
        maxDuration: f.properties?.['max_duration'],
        avgSpeed: f.properties?.['avg_speed'],
        avgWaitingTime: f.properties?.['avg_waiting_time'],
        maxWaitingTime: f.properties?.['max_waiting_time'],
        medianWaitingTime: f.properties?.['median_waiting_time'],
        midPoint: calculateMidPoint(f.geometry)
    }));
}

export function mapIntersectionEdgeToRows(fc: FeatureCollection<LineString>): IntersectionEdgeRow[] {
    return fc.features.map(f => ({
        id: f.properties?.['id'],
        osmId: f.properties?.['osm_id'],
        prevOsmId: f.properties?.['prev_osm_id'],
        nextOsmId: f.properties?.['next_osm_id'],
        rideId: f.properties?.['ride_id'],
        startTime: f.properties?.['start_time'],
        endTime: f.properties?.['end_time'],
        length: f.properties?.['length'],
        speed: f.properties?.['speed'],
        duration: f.properties?.['duration'],
        waitingTime: f.properties?.['waiting_time'],
        name: f.properties?.['name'],
        midPoint: calculateMidPoint(f.geometry)
    }));
}

export function mapIntersectionRegionAggregateToRows(fc: FeatureCollection<Polygon>): RegionAggregateRow[] {
    return fc.features.map(f => ({
        name: f.properties?.['name'],
        count: f.properties?.['number_of_rides'],
        nodeMedianWaitingTime: f.properties?.['node_median_waiting_time'],
        length: f.properties?.['length_km'],
        nodeWaitingPerKm: f.properties?.['node_waiting_s_per_km'],
        nodeMedianWaitingPerKm: f.properties?.['node_median_waiting_s_per_km'],
        edgeWaitingPerKm: f.properties?.['edge_waiting_s_per_km'],
        edgeMedianWaitingPerKm: f.properties?.['edge_median_waiting_s_per_km'],
    }));
}


