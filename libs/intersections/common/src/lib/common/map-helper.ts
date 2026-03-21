import { Feature, FeatureCollection, GeoJsonProperties, LineString, Point, Polygon } from 'geojson';
import { along, length, centroid } from '@turf/turf';
import * as maplibregl from 'maplibre-gl';
import { MapUtils } from '@simra/common-components';
import { Router } from '@angular/router';
import {
    MetricRequest,
    RegionMetricRow, 
    mapRegionMetricToRows
} from '@simra/intersections-common';
import {
    setPopUpPropertiesTrafficSignal,
    setPopUpPropertiesTrafficSignalCluster,
    setPopUpIntersectionMetrics
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
    sourceIds: string[];
    layerIds: string[];
    highlightLayerIds: string[];
}
export function addedOnMapDefault() : addedOnMap {
    return {
        sourceIds: [],
        layerIds: [],
        highlightLayerIds: []
    }
}
export function mergeAdded(target: addedOnMap, source: addedOnMap) {
    source.layerIds.forEach((id) => target.layerIds.push(id));
    source.highlightLayerIds.forEach((id) => target.highlightLayerIds.push(id));
    source.sourceIds.forEach((id) => target.sourceIds.push(id));
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

type LayerSpec = maplibregl.FillLayerSpecification | maplibregl.LineLayerSpecification | maplibregl.CircleLayerSpecification;
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
    const popupFunc = options.popupFunc ?? setDefaultPopUp;
    const layerId = options.sourceId + '-layer';

    addLayerOnMap(map, added, {
        id: layerId,
        type: 'circle',
        source: options.sourceId,
        paint: {
            'circle-radius': options.width,
            'circle-color': options.color,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#fff',
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
}



export function addLayersPolygon(map: maplibregl.Map, options: displayOptionsPolygon, added: addedOnMap) {
    options.minzoom = options.minzoom ?? ZOOM_LEVELS.polygons.minzoom;
    const popupFunc = options.popupFunc ?? setDefaultPopUp;
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

    if (!options.outlineWidth) return;
    addHighLightLayerOnMap(map, added, {
        id: options.sourceId + '-outline-layer',
        type: 'line',
        paint: {
            'line-color': 'rgb(0, 0, 0)',
            'line-width': options.outlineWidth,
        },
        ...commonLayerSettings
    })
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
    const popupFunc = options.popupFunc ?? setDefaultPopUp;
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

export function deleteDisplay(map: maplibregl.Map, added: addedOnMap) {
    added.layerIds.map((id) => map.removeLayer(id));
    added.highlightLayerIds.map((id) => map.removeLayer(id));
    added.sourceIds.map((id) => map.removeSource(id));

    added.highlightLayerIds = [];
    added.layerIds = [];
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

function setDefaultPopUp(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>) {
    setPopUp(mlMap, lngLat, properties, Object.keys(properties));
}

function setTrafficSignalClusterPopUp(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>) {
    setPopUpPropertiesTrafficSignalCluster(properties);
    setPopUp(mlMap, lngLat, properties, ["Id"]);
}

function setTrafficSignalPopUp(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>) {
    setPopUpPropertiesTrafficSignal(properties);
    setPopUp(mlMap, lngLat, properties, ["id"]);
}

function setMatchedPointPopUp(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>) {
    setPopUp(mlMap, lngLat, properties, ["id", "Time", "rideId", "IntersectionId", "ridePointId", "DistanceRidePoint", "AccuracyGPS", "stops"]);
}

function setRidePointPopUp(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>) {
    setPopUp(mlMap, lngLat, properties, ["id", "Time", "File"]);
}

function setIntersectionBasePopUp(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>) {
    setPopUp(mlMap, lngLat, properties, ["Id", "PrevSegmentId", "NextSegmentId", "Start", "IntersectionId", "Speed", "Duration", "WaitingTime"]);
}

function setIntersectionMetricsPopUp(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>) {
    setPopUpIntersectionMetrics(properties);
    setPopUp(mlMap, lngLat, properties, ["Id", "SegmentId", "name", "streetNames",  "numberOfRides", "Speed", "Duration", "WaitingTime"]);
}

function setRegionPopUp(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>) {
    setPopUp(mlMap, lngLat, properties, ["Id", "name", "numberOfRides", "NodeWaitingTime", "NodeWaitingSPerKm", "EdgeWaitingSPerKm"]);
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



export const COLORS = {
    'matchedPoints': '#ff0000ff',
    'ridePoints': '#007AFF',
    'trafficSignalClusters': '#b1b1b1d5',
    'trafficSignals': '#585858d5',
    'waitingTime': {
        0:   '#00ffb3ff',
        10:  '#3cff00ff',
        30:  '#fffb00ff',
        60:  '#ff9900ff',
        120: '#ff0000ff'
    },
    'regions': {
        0:  '#00ffb3ff',
        5:  '#3cff00ff',
        10: '#fffb00ff',
        20: '#ff9900ff',
        30: '#ff0000ff'
    }
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
    const added = addedOnMapDefault();
    const options: displayOptionsPoint = {
        sourceId: sourceId,
        width: 4,
        color: COLORS.matchedPoints,
        popupFunc: setMatchedPointPopUp
    };
    setSourceGeoJson(matchedPoints, map, options, added);
    addLayersPoint(map, options, added);
    return added;
}

export function displayRidePoints(map: maplibregl.Map, ridePoints: FeatureCollection<Point, GeoJsonProperties>, sourceId: string): addedOnMap {
    const added = addedOnMapDefault();
    const options: displayOptionsPoint = {
        sourceId: sourceId,
        width: 4,
        color: COLORS.ridePoints,
        popupFunc: setRidePointPopUp
    };
    setSourceGeoJson(ridePoints, map, options, added);
    addLayersPoint(map, options, added);
    return added;
}

const TRAFFIC_SIGNAL_CLUSTER_CONFIG : displayOptionsPolygon = {
    sourceId: "cluster",
    color: COLORS.trafficSignalClusters,
    popupFunc: setTrafficSignalClusterPopUp,
    minzoom: ZOOM_LEVELS.polygons.minzoom
};
export function displayTrafficSignalClusters(map: maplibregl.Map, trafficSignalClusters: FeatureCollection<Polygon, GeoJsonProperties>): addedOnMap {
    const added = addedOnMapDefault();
    setSourceGeoJson(trafficSignalClusters, map, TRAFFIC_SIGNAL_CLUSTER_CONFIG, added);
    addLayersPolygon(map, TRAFFIC_SIGNAL_CLUSTER_CONFIG, added);
    return added;
}
export function displayTrafficSignalClustersVectorTiles(map: maplibregl.Map, apiUrlVectorTile: string): addedOnMap {
    const added = addedOnMapDefault();
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
    popupFunc: setTrafficSignalPopUp,
    minzoom: ZOOM_LEVELS.points.minzoom
};
export function displayTrafficSignals(map: maplibregl.Map, trafficSignals: FeatureCollection<Point, GeoJsonProperties>): addedOnMap {
    const added = addedOnMapDefault();
    setSourceGeoJson(trafficSignals, map, TRAFFIC_SIGNAL_CONFIG, added);
    addLayersPoint(map, TRAFFIC_SIGNAL_CONFIG, added);
    return added;
}
export function displayTrafficSignalsVectorTiles(map: maplibregl.Map, apiUrlVectorTile: string): addedOnMap {
    const data = addedOnMapDefault();
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

function INTERSECTION_METRICS_CONFIG(_router: Router, sourceId: string, startMarker: boolean): displayOptionsLineString {
    return {
        sourceId: sourceId,
        startMarker: startMarker,
        sortKey: "numberOfRides",
        _router: _router,
        color: [
            'interpolate',
            ['linear'],
            ['get', 'medianWaitingTime'],
            ...colorToArray(COLORS.waitingTime)
        ],
        width: [
            'interpolate',
            ['linear'],
            ['get', 'numberOfRides'],
            1, 1.0,
            2, 2.0,
            5, 3.0,
            10, 4.0,
            50, 6.0
        ],
        popupFunc: setIntersectionMetricsPopUp,
        minzoom: ZOOM_LEVELS.lines.minzoom
    }
}
    
export function displayIntersectionAggregate (
    _router: Router, lines: FeatureCollection<LineString, GeoJsonProperties>, map: maplibregl.Map,
    sourceId: string, startMarker: boolean = true
): addedOnMap {
    const data = addedOnMapDefault();
    const options = INTERSECTION_METRICS_CONFIG(_router, sourceId, startMarker);
    setSourceGeoJson(lines, map, options, data, true);
    displayLineString(map, options, data);
    return data;
}
export function displayIntersectionAggregateVectorTiles (
    _router: Router, map: maplibregl.Map, apiUrlVectorTile: string,
    sourceId: string, request: MetricRequest, startMarker: boolean = true
): addedOnMap {
    const data = addedOnMapDefault();
    const options: displayOptionsLineString = {
        ...INTERSECTION_METRICS_CONFIG(_router, sourceId, startMarker),
        vectorTileOptions: {
            apiUrl: apiUrlVectorTile,
            endPoint: "intersections"
        }
    };
    setSourceVectorTiles(map, options, data, request);
    displayLineString(map, options, data);
    return data;
}

export function displayIntersection (
    _router: Router, lines: FeatureCollection<LineString, GeoJsonProperties>, map: maplibregl.Map, 
    sourceId: string, zoom: boolean = false, startMarker: boolean = true
): addedOnMap {
    const data = addedOnMapDefault();
    const options: displayOptionsLineString = {
        sourceId: sourceId,
        startMarker: startMarker,
        _router: _router,
        color: [
            'interpolate',
            ['linear'],
            ['get', 'waitingTime'],
            ...colorToArray(COLORS.waitingTime)
        ],
        ...(zoom && { minzoom: 11 }),
        popupFunc: setIntersectionBasePopUp
    };
    setSourceGeoJson(lines, map, options, data, true);
    displayLineString(map, options, data);
    return data;
}

export function displayRegions(
    polygons: FeatureCollection<Polygon, GeoJsonProperties>, map: maplibregl.Map, 
    sourceId: string, minzoom?:number, maxzoom?: number, filter?: any
): addedOnMap {
    const data = addedOnMapDefault();
    const options: displayOptionsPolygon = {
        sourceId: sourceId,
        minzoom: minzoom ? minzoom : 0,
        maxzoom: maxzoom,
        color: [
            'interpolate',
            ['linear'],
            ['get', 'nodeWaitingSPerKm'],
            ...colorToArray(COLORS.regions)
        ],
        outlineWidth: [
            'interpolate',
            ['linear'],
            ['get', 'numberOfRides'],
            10, 1.0,
            50, 3.0,
            500, 10.0
        ],
        filter: filter,
        popupFunc: setRegionPopUp
    };
    setSourceGeoJson(polygons, map, options, data);
    addLayersPolygon(map, options, data);
    return data;
}

export function getZoomLineFeature(data: LineString) {
    const midPoint = calculateMidPoint(data);
    return { lng: midPoint[0], lat: midPoint[1], zoom: 16};
}

export function getZoomLine(data: FeatureCollection<LineString, GeoJsonProperties>) {
    if (data.features.length === 0) return;
    return getZoomLineFeature(data.features[0].geometry);
}

export function zoomOnLineMidPoint(map: maplibregl.Map, data: FeatureCollection<LineString, GeoJsonProperties>) {
    const zoomProps = getZoomLine(data);
    if (!zoomProps) return;
    map.flyTo({ center: [zoomProps.lng, zoomProps.lat], zoom: zoomProps.zoom });
}

export function getZoomRegion(data: FeatureCollection<Polygon, GeoJsonProperties>) {
    if (data.features.length === 0) return;
    const polygonCentroid = centroid(data);
    const region: RegionMetricRow = mapRegionMetricToRows(data)[0];
    const adminLevel = region.adminLevel;
    const zoom = adminLevel === 4 ? 7 : 9;
    return { lng: polygonCentroid.geometry.coordinates[0], lat: polygonCentroid.geometry.coordinates[1], zoom: zoom }
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