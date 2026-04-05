import { Feature, FeatureCollection, GeoJsonProperties, LineString, Point, Polygon } from 'geojson';
import { along, length, centroid } from '@turf/turf';
import * as maplibregl from 'maplibre-gl';
import { MapUtils } from '@simra/common-components';
import { Router } from '@angular/router';
import {
    MetricRequest,
    BaseMetric,
    Base,
    RegionMetric
} from '@simra/intersections-common';
import {
    setPopUpIntersectionMetrics,
    setPopUpTrafficSignalCluster,
    setPopUpTrafficSignal,
    setPopUpMatchedPoints,
    setPopUpRidePoints,
    setPopUpIntersectionBase,
    setPopUpRegion
} from '@simra/intersections-domain';


export function calculateMidPoint(lineString: LineString) {
    const line: Feature<LineString> = {
        geometry: lineString,
        properties: {},
        type: "Feature"
    };
    const midpoint = along(line, length(line) / 2);
    const center = midpoint.geometry.coordinates;
    return center;
}

export const ZOOM_LEVELS = {
    'points': {'minzoom': 15, 'maxzoom': 22},
    'lines': {'minzoom': 11, 'maxzoom': 22},
    'polygons': {'minzoom': 11, 'maxzoom': 22},
    'regions': {'minzoom': 0, 'maxzoom': 11}
}

interface vectorTileOptions {
    apiUrl: string;
    endPoint: string;
}

export interface displayOptions {
    sourceId: string; 
    color: any;
    minzoom?: number;
    maxzoom?: number;
    popupFunc?: Function;
    vectorTileOptions?: vectorTileOptions;
}

function zoomProps(opts: { minzoom?: number; maxzoom?: number }) {
    return {
        ...(opts.minzoom !== undefined && { minzoom: opts.minzoom }),
        ...(opts.maxzoom !== undefined && { maxzoom: opts.maxzoom }),
    };
}

export interface addedOnMap {
    name: string;
    sourceIds: string[];
    layerIds: string[];
    highlightLayerIds: string[];
}
function addedOnMapDefault(name: string) : addedOnMap {
    return {
        name: name,
        sourceIds: [],
        layerIds: [],
        highlightLayerIds: []
    }
}


export interface displayOptionsPoint extends displayOptions {
    width: any;
}

export function setSourceGeoJson(data: FeatureCollection, map: maplibregl.Map, options: displayOptions, added: addedOnMap, extraLineStart: boolean = false) {
    addSourceOnMap(map, added, options.sourceId, {
        type: 'geojson',
        data: data,
    });
    if (!extraLineStart) return;
    addSourceOnMap(map, added, `${ options.sourceId }-start`, {
        type: 'geojson',
        data: getStartGeometries(data as FeatureCollection<LineString>)
    })
}


export function setSourceVectorTiles(map: maplibregl.Map, options: displayOptions, added: addedOnMap, request: MetricRequest | undefined = undefined) {
    const tileOptions = options.vectorTileOptions;
    if (!tileOptions) {
        console.error("Vector Tile configuration is missing.");
        return;
    }
    const requestString = request ? `?numberOfRides=${request.numberOfRides}&weekDay=${request.weekDay}&trafficTime=${request.trafficTime}&year=${request.year}` : "";
    addSourceOnMap(map, added, options.sourceId, {
        type: 'vector',
        tiles: [`${tileOptions.apiUrl}/api/${tileOptions.endPoint}/${options.sourceId}/tiles/{z}/{x}/{y}.pbf${requestString}`],
        minzoom: options.minzoom
    });
    if (!request) return;
    addSourceOnMap(map, added, `${ options.sourceId }-start`, {
        type: 'vector',
        tiles: [`${tileOptions.apiUrl}/api/${tileOptions.endPoint}/${options.sourceId}/start/tiles/{z}/{x}/{y}.pbf${requestString}`],
        minzoom: options.minzoom
    })
}

function addSourceOnMap(map: maplibregl.Map, added: addedOnMap, sourceId: string, sourceSpecs: maplibregl.SourceSpecification) {
    map.addSource(sourceId, sourceSpecs);
    added.sourceIds.push(sourceId);
}

type LayerSpec = maplibregl.FillLayerSpecification | maplibregl.LineLayerSpecification | maplibregl.CircleLayerSpecification | maplibregl.SymbolLayerSpecification;
function _addLayer(map: maplibregl.Map, layerSpecs: LayerSpec) : boolean {
    if (!map.getSource(layerSpecs.source)) {
        console.error(`No source for layer ${layerSpecs.id}`);
        return false;
    }
    map.addLayer(layerSpecs);
    return true;
}
function addLayerOnMap(map: maplibregl.Map, added: addedOnMap, layerSpecs: LayerSpec) {
    if (_addLayer(map, layerSpecs)) {
        added.layerIds.push(layerSpecs.id);
    }
}
function addHighLightLayerOnMap(map: maplibregl.Map, added: addedOnMap, layerSpecs: LayerSpec) {
    if (_addLayer(map, layerSpecs)) {
        added.highlightLayerIds.push(layerSpecs.id);
    }
}


export function addLayersPoint(map: maplibregl.Map, options: displayOptionsPoint, added: addedOnMap) {
    options.minzoom = options.minzoom ?? ZOOM_LEVELS.points.minzoom;
    const popupFunc = options.popupFunc ?? popUpDefault;
    const layerId = options.sourceId + '-layer';

    addLayerOnMap(map, added, {
        id: layerId,
        type: 'circle',
        source: options.sourceId,
        paint: {
            'circle-radius': options.width,
            'circle-color': options.color
        },
        ...(options.vectorTileOptions && {"source-layer": layerId }),
        ...zoomProps(options)
    })
    // TODO: do clean up of map.on
    map.on('click', layerId, e => {
        const properties = e.features?.[0].properties;
        if (properties) {
            popupFunc(map, e.lngLat, properties);
        }
    });
}

export interface displayOptionsPolygon extends displayOptions {
    outlineWidth?: any;
    filter?: any;
    name?: boolean; 
}



export function addLayersPolygon(map: maplibregl.Map, options: displayOptionsPolygon, added: addedOnMap) {
    options.minzoom = options.minzoom ?? ZOOM_LEVELS.polygons.minzoom;
    const popupFunc = options.popupFunc ?? popUpDefault;
    const layerId = options.sourceId + '-layer';
    const commonLayerSettings = {
        source: options.sourceId,
        ...(options.vectorTileOptions && {"source-layer": layerId }),
        ...zoomProps(options),
        ...(options.filter && {filter: options.filter})
    }

    addLayerOnMap(map, added, {
        id: layerId,
        type: 'fill',
        paint: {
            'fill-color': options.color,
            'fill-opacity': 0.8
        },
        ...commonLayerSettings
    })
    map.on('click', layerId, e => {
        const properties = e.features?.[0].properties;
        if (properties) {
            popupFunc(map, e.lngLat, properties);
        }
    });

    if (options.outlineWidth) {
        addHighLightLayerOnMap(map, added, {
            id: options.sourceId + '-outline-layer',
            type: 'line',
            paint: {
                'line-color': 'rgb(0, 0, 0)',
                'line-width': options.outlineWidth,
                'line-offset': ['+', ['*', options.outlineWidth, 0.5], 1]
            },
            ...commonLayerSettings
        })
        addHighLightLayerOnMap(map, added, {
            id: options.sourceId + '-outline-layer-white',
            type: 'line',
            paint: {
                'line-color': 'rgb(255, 255, 255)',
                'line-width': 1,
            },
            ...commonLayerSettings
        })
    }
    
    if (options.name) {
        addHighLightLayerOnMap(map, added, {
			id: options.sourceId + '-name-layer',
			type: 'symbol',
			layout: {
				'text-field': ['get', 'name'],
				'text-size': 12,
				'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
				'text-anchor': 'center',
			},
			paint: {
				'text-color': '#000000',
				'text-halo-color': '#ffffff',
				'text-halo-width': 1,
			},
			...commonLayerSettings
		})
    }
}

function withOffset (baseWidth: number | any[], offset: number) {
    return ['+', baseWidth, offset];
}

export interface displayOptionsLineString extends displayOptions {
    _router: Router;
    width?: any;
    sortKey?: string;
    startMarker: boolean;
}

function getStartGeometries(lineString: FeatureCollection<LineString>): FeatureCollection<Point>  {
    return {
        type: 'FeatureCollection',
        features: lineString.features.map((f) => {
            const props = f.properties;
            if (!props || !props["id"] || typeof props["id"] !== "number") {
                console.error("Properties not properly defined: ", props);
            }

            const startPoint: Point = { "type": "Point", "coordinates": f.geometry.coordinates[0]};
            const startFeature: Feature<Point> = {"type": "Feature", "geometry": startPoint, "properties": props};
            return startFeature;
        })
    };
}

export function displayLineString(map: maplibregl.Map, options: displayOptionsLineString, added: addedOnMap) {
    options.minzoom = options.minzoom ?? ZOOM_LEVELS.lines.minzoom;
    const popupFunc = options.popupFunc ?? popUpDefault;
    const width = options.width ?? 2;
    const layerId = options.sourceId + '-layer';
    const commonLayerSettings = {
        source: options.sourceId,
        ...(options.vectorTileOptions && {"source-layer": layerId }),
        ...zoomProps(options),
        
    }
    
    addLayerOnMap(map, added, {
        id: layerId,
        type: 'line',
        paint: {
            'line-color': options.color,
            'line-width': width,
        },
        layout: {
            ...(options.sortKey && {"line-sort-key": ['get', options.sortKey]})
        },
        ...commonLayerSettings,
    });
    MapUtils.changeCursor(map, layerId);
    map.on('click', layerId, e => {
        const properties = e.features?.[0].properties;
        if (properties) {
            popupFunc(map, e.lngLat, properties);
            applyQueryParamsForLineHighlight(options._router, properties['id'], e.lngLat.lat, e.lngLat.lng, false, options.sourceId);
        }
    });

    addHighLightLayerOnMap(map, added, {
        id: options.sourceId + '-highlight-color',
        type: 'line',
        paint: {
            'line-color': options.color,
            'line-width': width,
        },
        filter: ['==', ['get', "id"], NaN],
        ...commonLayerSettings
    });
    addHighLightLayerOnMap(map, added, {
        id: options.sourceId + '-highlight',
        type: 'line',
        paint: {
            'line-color': '#000000ff',
            'line-width': withOffset(width, 1) as any,
            'line-gap-width':  width,
        },
        filter: ['==', ['get', 'id'], NaN],
        ...commonLayerSettings
    });

    const startMarkerSourceId = `${ options.sourceId }-start`;
    const startMarkerLayerId = startMarkerSourceId + '-layer';
    const startMarkerSettings = {...commonLayerSettings};
    startMarkerSettings.source = startMarkerSourceId;
    startMarkerSettings.minzoom = ZOOM_LEVELS.points.minzoom;
    if (options.vectorTileOptions) {
        startMarkerSettings['source-layer'] = startMarkerLayerId;
    }

    if (options.startMarker) {
        addLayerOnMap(map, added, {
            id: startMarkerLayerId,
            type: 'circle',
            paint: {
                'circle-color': options.color,
                'circle-radius': withOffset(width, 3) as any,
            },
            layout: {
                ...(options.sortKey && {"circle-sort-key": ["*", ['get', options.sortKey], -1] })
            },
            ...startMarkerSettings,
        })
        MapUtils.changeCursor(map, startMarkerLayerId);
        map.on('click', startMarkerLayerId, e => {
            const properties = e.features?.[0].properties;
            if (properties) {
                popupFunc(map, e.lngLat, properties);
                applyQueryParamsForLineHighlight(options._router, properties['id'], e.lngLat.lat, e.lngLat.lng, false, options.sourceId);
            }
        });
    }

    addHighLightLayerOnMap(map, added, {
        id: startMarkerSourceId + '-highlight',
        type: 'circle',
        paint: {
            'circle-color': '#000000ff',
            'circle-radius': withOffset(width, 5) as any,
        },
        filter: ['==', ['get', 'id'], NaN],
        ...startMarkerSettings
    })
}

function deleteLayers(map: maplibregl.Map, added: addedOnMap) {
    added.layerIds.forEach(id => map.removeLayer(id));
    added.highlightLayerIds.forEach(id => map.removeLayer(id));

    added.highlightLayerIds = [];
    added.layerIds = [];
}
export function deleteDisplay(map: maplibregl.Map, added: addedOnMap) {
    deleteLayers(map, added);
    added.sourceIds.forEach(id => map.removeSource(id));
    added.sourceIds = [];
}

export function setPopUp(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>, keys: string[]) {
    let html = properties["header"] ? `<h1><b>${properties["header"]}</h1></b>` : "";
    for (const key of keys) {
        if (Object.hasOwn(properties, key)) {
            html += `<b>${key}</b>: ${properties[key]}<br>`
        }
    }
    new maplibregl.Popup()
        .setLngLat(lngLat)
        .setHTML(html)
        .addTo(mlMap);
}

function popUpDefault(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>) {
    setPopUp(mlMap, lngLat, properties, Object.keys(properties));
}

function popUpTrafficSignalCluster(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>) {
    setPopUpTrafficSignalCluster(properties);
    setPopUp(mlMap, lngLat, properties, ["Id"]);
}

function popUpTrafficSignal(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>) {
    setPopUpTrafficSignal(properties);
    setPopUp(mlMap, lngLat, properties, ["id"]);
}

function popUpMatchedPoint(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>) {
    setPopUpMatchedPoints(properties);
    setPopUp(mlMap, lngLat, properties, ["id", "Time", "rideId", "IntersectionId", "ridePointId", "DistanceRidePoint", "AccuracyGPS", "stops"]);
}

function popUpRidePoint(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>) {
    setPopUpRidePoints(properties);
    setPopUp(mlMap, lngLat, properties, ["id", "Time", "File"]);
}

function popUpIntersectionBase(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>) {
    setPopUpIntersectionBase(properties);
    setPopUp(mlMap, lngLat, properties, ["Id", "PrevSegmentId", "NextSegmentId", "Start", "IntersectionId", "Speed", "Duration", "WaitingTime"]);
}

function popUpIntersectionMetrics(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>) {
    setPopUpIntersectionMetrics(properties);
    setPopUp(mlMap, lngLat, properties, ["Id", "SegmentId", "name", "streetNames",  "numberOfRides", "MeanSpeed", "MeanDuration", "MeanWaitingTime", "MeanWaitingTimeStopped", "StopRate"]);
}

function popUpRegion(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>) {
    setPopUpRegion(properties);
    setPopUp(mlMap, lngLat, properties, ["Id", "name", "numberOfRides", "NodesPerKm", "NodeWaiting%", "NodeWaitingAvg", "NodeWaitingSPerKm", "EdgeWaitingSPerKm"]);
}

export function removeLineHighlight(map: maplibregl.Map, added: addedOnMap) {
    for (const layer of added.highlightLayerIds) {
        map.setFilter(layer, [
            '==',
            ['get', 'id'],
            NaN
        ])
    }
}

export function getWaitingTimeColors(maxValue: number = 60) {
    return {
        0:  '#3cff00ff',
        [Math.floor(maxValue * 1/3)]: '#fffb00ff',
        [Math.floor(maxValue * 2/3)] : '#ff9900ff',
        [maxValue]: '#ff0000ff'
    }
}
export const COLORS = {
    'matchedPoints': 'rgb(18, 146, 250)',
    'ridePoints': '#0d0085',
    'trafficSignalClusters': '#b1b1b1d5',
    'trafficSignals': '#585858d5',
}

export interface LegendItem {
    label: string;
    geometry: 'point' | 'line' | 'polygon';
    color?: string;
    colorStops?: { value: number; color: string }[];
    widthStops?: { value: number; width: number }[];
}

export interface LegendItemVisible extends LegendItem {
    showIf: boolean;
}

export function getVisibleLegendItems(definitions: LegendItemVisible[]): LegendItem[] {
  return definitions
    .filter(d => d.showIf)
    .map(({ showIf, ...item }) => item);
}

export function colorToStops(color: Record<number, string>) {
    return Object.entries(color).map(([v, c]) => ({
        value: Number(v),
        color: c
    }))
}

function colorToArray(color: Record<number, string>) {
    const colorArray = [];
    for (const key in color) {
        colorArray.push(Number(key));
        colorArray.push(color[key]);
    }
    return colorArray;
}

export function displayMatchedPoints(map: maplibregl.Map, matchedPoints: FeatureCollection<Point, GeoJsonProperties>, sourceId: string): addedOnMap{
    const added = addedOnMapDefault(sourceId);
    const options: displayOptionsPoint = {
        sourceId: sourceId,
        width: 4,
        color: COLORS.matchedPoints,
        popupFunc: popUpMatchedPoint
    };
    setSourceGeoJson(matchedPoints, map, options, added);
    addLayersPoint(map, options, added);
    return added;
}

export function displayRidePoints(map: maplibregl.Map, ridePoints: FeatureCollection<Point, GeoJsonProperties>, sourceId: string): addedOnMap {
    const added = addedOnMapDefault(sourceId);
    const options: displayOptionsPoint = {
        sourceId: sourceId,
        width: 4,
        color: COLORS.ridePoints,
        popupFunc: popUpRidePoint
    };
    setSourceGeoJson(ridePoints, map, options, added);
    addLayersPoint(map, options, added);
    return added;
}

const TRAFFIC_SIGNAL_CLUSTER_CONFIG : displayOptionsPolygon = {
    sourceId: "cluster",
    color: COLORS.trafficSignalClusters,
    popupFunc: popUpTrafficSignalCluster,
    minzoom: ZOOM_LEVELS.polygons.minzoom
};
export function displayTrafficSignalClusters(map: maplibregl.Map, trafficSignalClusters: FeatureCollection<Polygon, GeoJsonProperties>): addedOnMap {
    const added = addedOnMapDefault(TRAFFIC_SIGNAL_CLUSTER_CONFIG.sourceId);
    setSourceGeoJson(trafficSignalClusters, map, TRAFFIC_SIGNAL_CLUSTER_CONFIG, added);
    addLayersPolygon(map, TRAFFIC_SIGNAL_CLUSTER_CONFIG, added);
    return added;
}
export function displayTrafficSignalClustersVectorTiles(map: maplibregl.Map, apiUrlVectorTile: string): addedOnMap {
    const added = addedOnMapDefault(TRAFFIC_SIGNAL_CLUSTER_CONFIG.sourceId);
    const options: displayOptionsPolygon = {
        ...TRAFFIC_SIGNAL_CLUSTER_CONFIG,
        vectorTileOptions: {
            apiUrl: apiUrlVectorTile,
            endPoint: "osm"
        }
    }
    setSourceVectorTiles(map, options, added);
    addLayersPolygon(map, options, added);
    return added;
}

const TRAFFIC_SIGNAL_CONFIG : displayOptionsPoint= {
    sourceId: "signal",
    width: 6,
    color: COLORS.trafficSignals,
    popupFunc: popUpTrafficSignal,
    minzoom: ZOOM_LEVELS.points.minzoom
};
export function displayTrafficSignals(map: maplibregl.Map, trafficSignals: FeatureCollection<Point, GeoJsonProperties>): addedOnMap {
    const added = addedOnMapDefault(TRAFFIC_SIGNAL_CONFIG.sourceId);
    setSourceGeoJson(trafficSignals, map, TRAFFIC_SIGNAL_CONFIG, added);
    addLayersPoint(map, TRAFFIC_SIGNAL_CONFIG, added);
    return added;
}
export function displayTrafficSignalsVectorTiles(map: maplibregl.Map, apiUrlVectorTile: string): addedOnMap {
    const data = addedOnMapDefault(TRAFFIC_SIGNAL_CONFIG.sourceId);
    const options: displayOptionsPoint = {
        ...TRAFFIC_SIGNAL_CONFIG,
        vectorTileOptions: {
            apiUrl: apiUrlVectorTile,
            endPoint: "osm",
        }
    }
    setSourceVectorTiles(map, options, data);
    addLayersPoint(map, options, data);
    return data;
}

function AGGREGATE_SEGMENT_CONFIG(_router: Router, sourceId: string, startMarker: boolean, 
    colorProperty: keyof BaseMetric, colorMax: number, widthMax: number, apiUrlVectorTile?: string,
): displayOptionsLineString {
    return {
        sourceId: sourceId,
        startMarker: startMarker,
        sortKey: "numberOfRides",
        _router: _router,
        color: [
            'interpolate',
            ['linear'],
            ['get', colorProperty],
            ...colorToArray(getWaitingTimeColors(colorMax))
        ],
        width: ([
            'interpolate', ['linear'], 
            ['get', 'numberOfRides'], 
            1, 1.0, 
            widthMax, 5.0
        ]),
        popupFunc: popUpIntersectionMetrics,
        minzoom: ZOOM_LEVELS.lines.minzoom,
        ...(apiUrlVectorTile && { vectorTileOptions: {
            apiUrl: apiUrlVectorTile,
            endPoint: "intersections"
        }})
    }
}
export function getAggrageteSegmentDefaults() {
    const colorProperty: keyof BaseMetric = "avgWaitingTime";
    const colorMax: number = 60;
    const widthMax: number = 50;
    return {
        colorProperty: colorProperty,
        colorMax: colorMax,
        widthMax: widthMax
    }
}
export function styleAggregateSegment(map: maplibregl.Map, data: addedOnMap, _router: Router, colorProperty: keyof BaseMetric, colorMax: number, widthMax: number, startMarker: boolean, apiUrlVectorTile?: string) {
    deleteLayers(map, data);
    const options = AGGREGATE_SEGMENT_CONFIG(_router, data.name, startMarker, colorProperty, colorMax, widthMax, apiUrlVectorTile);
    displayLineString(map, options, data);
}
export function displayAggregateSegment (
    _router: Router, lines: FeatureCollection<LineString, GeoJsonProperties>, map: maplibregl.Map, sourceId: string, 
    startMarker: boolean = true
): addedOnMap {
    const data = addedOnMapDefault(sourceId);
    const defaults = getAggrageteSegmentDefaults();
    const options = AGGREGATE_SEGMENT_CONFIG(_router, sourceId, startMarker, defaults.colorProperty, defaults.colorMax, defaults.widthMax);
    setSourceGeoJson(lines, map, options, data, true);
    displayLineString(map, options, data);
    return data;
}
export function displayAggregateSegmentVectorTiles (
    _router: Router, map: maplibregl.Map, apiUrlVectorTile: string, sourceId: string, request: MetricRequest, 
    startMarker: boolean = true
): addedOnMap {
    const data = addedOnMapDefault(sourceId);
    const defaults = getAggrageteSegmentDefaults();
    const options = AGGREGATE_SEGMENT_CONFIG(_router, sourceId, startMarker, defaults.colorProperty, defaults.colorMax, defaults.widthMax, apiUrlVectorTile);
    setSourceVectorTiles(map, options, data, request);
    displayLineString(map, options, data);
    return data;
}

function RIDE_SEGMENT_CONFIG(_router: Router, sourceId: string, startMarker: boolean, colorProperty: keyof Base, colorMax: number): displayOptionsLineString {
    return {
        sourceId: sourceId,
        startMarker: startMarker,
        _router: _router,
        color: [
            'interpolate',
            ['linear'],
            ['get', colorProperty],
            ...colorToArray(getWaitingTimeColors(colorMax))
        ],
        popupFunc: popUpIntersectionBase
    };
}
export function getRideSegmentDefaults() {
    const colorProperty: keyof Base = "waitingTime";
    const colorMax: number = 60;
    return {
        colorProperty: colorProperty,
        colorMax: colorMax
    }
}
export function styleRideSegment(map: maplibregl.Map, data: addedOnMap, _router: Router, colorProperty: keyof Base, colorMax: number, startMarker: boolean) {
    deleteLayers(map, data);
    const options = RIDE_SEGMENT_CONFIG(_router, data.name, startMarker, colorProperty, colorMax);
    displayLineString(map, options, data);
}
export function displayRideSegment (
    _router: Router, lines: FeatureCollection<LineString, GeoJsonProperties>, map: maplibregl.Map, 
    sourceId: string, startMarker: boolean = true
): addedOnMap {
    const data = addedOnMapDefault(sourceId);
    const defaults = getRideSegmentDefaults();
    const options = RIDE_SEGMENT_CONFIG(_router, sourceId, startMarker, defaults.colorProperty, defaults.colorMax);
    setSourceGeoJson(lines, map, options, data, true);
    displayLineString(map, options, data);
    return data;
}

function REGION_CONFIG(sourceId: string,
    colorProperty: keyof RegionMetric, colorMax: number, widthMax: number,
     minzoom?:number, maxzoom?: number, filter?: any,
): displayOptionsPolygon {
    return {
        sourceId: sourceId,
        name: true,
        minzoom: minzoom ? minzoom : 0,
        maxzoom: maxzoom,
        color: [
            'interpolate',
            ['linear'],
            ['get', colorProperty],
            ...colorToArray(getWaitingTimeColors(colorMax))
        ],
        outlineWidth: [
            'interpolate',
            ['linear'],
            ['get', 'numberOfRides'],
            1, 1.0,
            widthMax, 5.0
        ],
        filter: filter,
        popupFunc: popUpRegion
    }
}
export function getRegionDefaults() {
    const colorProperty: keyof RegionMetric = "nodeWaitingRate";
    const colorMax: number = 15;
    const widthMax: number = 1000;
    return {
        colorProperty: colorProperty,
        colorMax: colorMax,
        widthMax: widthMax
    }
}
export function styleRegions(map: maplibregl.Map, data: addedOnMap, colorProperty: keyof RegionMetric, colorMax: number, widthMax: number, minzoom?:number, maxzoom?: number, filter?: any) {
    deleteLayers(map, data);
    const options = REGION_CONFIG(data.name, colorProperty, colorMax, widthMax, minzoom, maxzoom, filter);
    addLayersPolygon(map, options, data);
}
export function displayRegions(
    polygons: FeatureCollection<Polygon, GeoJsonProperties>, map: maplibregl.Map, 
    sourceId: string, minzoom?:number, maxzoom?: number, filter?: any
): addedOnMap {
    const data = addedOnMapDefault(sourceId);
    const defaults = getRegionDefaults();
    const options = REGION_CONFIG(sourceId, defaults.colorProperty, defaults.colorMax, defaults.widthMax, minzoom, maxzoom, filter);
    setSourceGeoJson(polygons, map, options, data);
    addLayersPolygon(map, options, data);
    return data;
}

export function removeQueryParamsForLineHighlight(_router: Router) {
    _router.navigate([], {
        queryParams: { "lng": null, "lat": null, "id": null, "zoom": null, "moveTo": false, "sourceId": null },
        queryParamsHandling: 'merge',
    });
}

export function highlightLine(map: maplibregl.Map, added: addedOnMap, sourceId: string, selectedId: number) {
    if (!added.sourceIds.includes(sourceId)) {
        removeLineHighlight(map, added);
        return;
    }

    // Make highlight layer visible for specified id
    for (const layer of added.highlightLayerIds) {
        if (map.getLayer(layer)) {
            map.setFilter(layer, [
                '==',
                ['number', ['get', 'id'], NaN],
                selectedId
            ]);
        }
    }
}

export function applyQueryParamsForLineHighlight(_router: Router, id: number, lat: number, lon: number, moveTo: boolean, sourceId: string) {
    _router.navigate([], {
        queryParams: { id: id, lat: lat.toFixed(5), lng: lon.toFixed(5), zoom: 16, moveTo: moveTo, sourceId },
        queryParamsHandling: 'merge',
    });
}

export function waitForSource(map: maplibregl.Map, sourceId: string, timeoutMs = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
        if (map.getSource(sourceId) && map.isSourceLoaded(sourceId)) {
            resolve();
            return;
        }

        let timer: undefined | ReturnType<typeof setTimeout>;

        const onSourceData = (e: maplibregl.MapSourceDataEvent) => {
            // Check if this event is for our source and if it is fully loaded
            if (e.sourceId === sourceId && map.isSourceLoaded(sourceId) && e.isSourceLoaded) {
                map.off('sourcedata', onSourceData);
                clearTimeout(timer);
                resolve();
            }
        };

        map.on('sourcedata', onSourceData);

        // Fail if it takes too long
        timer = setTimeout(() => {
            map.off('sourcedata', onSourceData);
            reject(new Error(`Source '${sourceId}' not found after ${timeoutMs}ms`));
        }, timeoutMs);
    });
}