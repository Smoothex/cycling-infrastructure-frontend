import { Feature, FeatureCollection, GeoJsonProperties, LineString, Point, Polygon } from 'geojson';
import { along, length } from '@turf/turf';
import * as maplibregl from 'maplibre-gl';
import { MapUtils } from '@simra/common-components';
import { Router, Params } from '@angular/router';

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

export interface displayOptions {
    sourceId: string; 
    color: any;
    minzoom?: number;
    maxzoom?: number;
    popupFunc?: Function;
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


export interface displayOptionsPoint extends displayOptions {
    width: any;
}

export function displayPoints(points: FeatureCollection<Point>, map: maplibregl.Map, options: displayOptionsPoint): addedOnMap {
    const popupFunc = options.popupFunc ?? setDefaultPopUp;
    const layerId = options.sourceId + '-layer';
    options.minzoom = options.minzoom ?? 14;

    map.addSource(options.sourceId, {
        type: 'geojson',
        data: points,
    });

    map.addLayer({
        id: layerId,
        type: 'circle',
        source: options.sourceId,
        paint: {
            'circle-radius': options.width,
            'circle-color': options.color,
            'circle-stroke-width': 1,
            'circle-stroke-color': '#fff',
        },
        ...zoomProps(options)
    });
    // TODO: do clean up of map.on
    map.on('click', layerId, e => {
        const properties = e.features?.[0].properties;
        if (properties) {
            popupFunc(map, e.lngLat, properties);
        }
    });

    return {
        sourceIds: [options.sourceId],
        layerIds: [layerId],
        highlightLayerIds: []
    }
}

export interface displayOptionsPolygon extends displayOptions {
    outlineWidth?: any;
    filter?: any;
}

export function displayPolygons(polygons: FeatureCollection<Polygon>, map: maplibregl.Map, options: displayOptionsPolygon) : addedOnMap {
    const popupFunc = options.popupFunc ?? setDefaultPopUp;
    const layerId = options.sourceId + '-layer';
    const outlineLayerId = options.sourceId + '-outline-layer';
    const added: addedOnMap = {
        sourceIds: [options.sourceId],
        layerIds: [layerId],
        highlightLayerIds: []
    };
    
    map.addSource(options.sourceId, {
        type: 'geojson',
        data: polygons,
    });

    map.addLayer({
        id: layerId,
        type: 'fill',
        source: options.sourceId,
        layout: {},
        paint: {
            'fill-color': options.color,
            'fill-opacity': 0.8
        },
        ...zoomProps(options),
        ...(options.filter && {filter: options.filter})
    });
    map.on('click', layerId, e => {
        const properties = e.features?.[0].properties;
        if (properties) {
            popupFunc(map, e.lngLat, properties);
        }
    });

    if (options.outlineWidth) {
        map.addLayer({
            id: outlineLayerId,
            type: 'line',
            source: options.sourceId,
            layout: {},
            paint: {
                'line-color': 'rgb(0, 0, 0)',
                'line-width': options.outlineWidth,
            },
            ...zoomProps(options),
            ...(options.filter && {filter: options.filter})
        });
        added.highlightLayerIds.push(outlineLayerId);
    }

    return added;
}

export interface displayOptionsLineString extends displayOptions {
    _router: Router;
    width?: any;
    highlightWidth?: any;
    sortKey?: string;
    startMarker: boolean;
}

export function displayLineString(lineString: FeatureCollection<LineString>, map: maplibregl.Map, options: displayOptionsLineString) : addedOnMap {
    const popupFunc = options.popupFunc ?? setDefaultPopUp;
    const width = options.width ?? 2;
    const highlightWidth = options.highlightWidth ?? 3;

    const layerId = options.sourceId + '-layer';
    const highlightColorLayerId = options.sourceId + '-highlight-color';
    const highlightLayerId = options.sourceId + '-highlight';

    const startMarkerSource = options.sourceId + '-start';
    const startMarkerLayerId = startMarkerSource + '-layer';
    const startMarkerHighlightLayer = startMarkerSource + '-highlight';

    const startFeature:FeatureCollection<Point> = {
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

    const added: addedOnMap = {
        sourceIds: [options.sourceId],
        layerIds: [layerId],
        highlightLayerIds: []
    };

    map.addSource(options.sourceId, {
        type: 'geojson',
        data: lineString,
    });

    map.addLayer({
        id: layerId,
        type: 'line',
        source: options.sourceId,
        paint: {
            'line-color': options.color,
            'line-width': width,
        },
        ...zoomProps(options),
        ...(options.sortKey && {'line-sort-key': ['get', options.sortKey]})
    });
    MapUtils.changeCursor(map, layerId);
    map.on('click', layerId, e => {
        const properties = e.features?.[0].properties;
        if (properties) {
            popupFunc(map, e.lngLat, properties);
            applyQueryParamsForLineHighlight(options._router, properties['id'], e.lngLat.lat, e.lngLat.lng, false, options.sourceId);
        }
    });

    map.addLayer({
        id: highlightColorLayerId,
        type: 'line',
        source: options.sourceId,
        paint: {
            'line-color': options.color,
            'line-width': width,
        },
        filter: ['==', ['get', "id"], NaN],
        ...zoomProps(options)
    });
    added.highlightLayerIds.push(highlightColorLayerId);

    map.addLayer({
        id: highlightLayerId,
        type: 'line',
        source: options.sourceId,
        paint: {
            'line-color': '#000000ff',
            'line-width': highlightWidth,
            'line-gap-width':  width,
        },
        filter: ['==', ['get', 'id'], NaN],
        ...zoomProps(options)
    });
    added.highlightLayerIds.push(highlightLayerId);

    map.addSource(startMarkerSource, {
        type: 'geojson',
        data: startFeature,
    });
    added.sourceIds.push(startMarkerSource);

    const circleZoom = zoomProps(options);
    if (circleZoom.minzoom) {
        circleZoom.minzoom += 3;
    }

    if (options.startMarker) {
        map.addLayer({
            id: startMarkerLayerId,
            type: 'circle',
            source: startMarkerSource,
            paint: {
                'circle-color': options.color,
                'circle-radius': 5,
            },
            ...circleZoom,
            ...(options.sortKey && {'circle-sort-key': ["*", NaN, 'get', options.sortKey]})
        })
        added.layerIds.push(startMarkerLayerId);
        MapUtils.changeCursor(map, startMarkerLayerId);
        map.on('click', startMarkerLayerId, e => {
            const properties = e.features?.[0].properties;
            if (properties) {
                popupFunc(map, e.lngLat, properties);
                applyQueryParamsForLineHighlight(options._router, properties['id'], e.lngLat.lat, e.lngLat.lng, false, options.sourceId);
            }
        });
    }
    map.addLayer({
        id: startMarkerHighlightLayer,
        type: 'circle',
        source: startMarkerSource,
        paint: {
            'circle-color': '#000000ff',
            'circle-radius': 7,
        },
        filter: ['==', ['get', 'id'], NaN],
        ...circleZoom
    })
    added.highlightLayerIds.push(startMarkerHighlightLayer);

    return added;
}

export function deleteDisplay(map: maplibregl.Map, added: addedOnMap) {
    added.layerIds.map((id) => map.removeLayer(id));
    added.highlightLayerIds.map((id) => map.removeLayer(id));
    added.sourceIds.map((id) => map.removeSource(id));

    added.highlightLayerIds = [];
    added.layerIds = [];
    added.sourceIds = [];
}

export function setPopUp(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>, keys: string[], header: string = "", ) {
    let html = header ? `<h1><b>${header}</h1></b>` : "";
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
    setPopUp(mlMap, lngLat, properties, ["Id"], "Traffic Signal Cluster");
}

function setTrafficSignalPopUp(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>) {
    setPopUp(mlMap, lngLat, properties, ["id"], "Traffic Signal");
}

function setMatchedPointPopUp(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>) {
    setPopUp(mlMap, lngLat, properties, ["id", "Time", "IntersectionId", "ridePointId", "DistanceRidePoint", "AccuracyGPS", "stops"], "Matched Point");
}

function setRidePointPopUp(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>) {
    setPopUp(mlMap, lngLat, properties, ["id", "Time", "File"], "Ride Point");
}

function setIntersectionBasePopUp(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>) {
    setPopUp(mlMap, lngLat, properties, ["Id", "PrevSegmentId", "NextSegmentId", "Start", "TrafficSignalClusterId", "Speed", "Duration", "WaitingTime"], "Segment");
}

function setIntersectionMetricsPopUp(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>) {
    setPopUp(mlMap, lngLat, properties, ["TrafficSignalClusterId", "OsmId", "SegmentId", "name", "streetNames",  "numberOfRides", "Speed", "Duration", "WaitingTime"], "Metrics");
}

function setRegionPopUp(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, string>) {
    setPopUp(mlMap, lngLat, properties, ["Id", "name", "numberOfRides", "NodeWaitingTime", "NodeWaitingSPerKm", "EdgeWaitingSPerKm"], "Region");
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


export function displayMatchedPoints(map: maplibregl.Map, matchedPoints: FeatureCollection<Point, GeoJsonProperties>, sourceId: string) {
    return displayPoints(matchedPoints, map, {
        sourceId: sourceId,
        width: 4,
        color: '#ff0000ff',
        popupFunc: setMatchedPointPopUp
    });
}

export function displayRidePoints(map: maplibregl.Map, ridePoints: FeatureCollection<Point, GeoJsonProperties>, sourceId: string) {
    return displayPoints(ridePoints, map, {
        sourceId: sourceId,
        width: 4,
        color: '#007AFF',
        popupFunc: setRidePointPopUp
    });
}

export function displayTrafficSignalClusters(map: maplibregl.Map, trafficSignalClusters: FeatureCollection<Polygon, GeoJsonProperties>, zoom: boolean = false) {
    return displayPolygons(trafficSignalClusters, map, {
        sourceId: "trafficSignalClustersPolygons",
        color: "#b1b1b1d5",
        popupFunc: setTrafficSignalClusterPopUp,
        ...(zoom && { minzoom: 11 })
    });
}

export function displayTrafficSignals(map: maplibregl.Map, trafficSignals: FeatureCollection<Point, GeoJsonProperties>) {
    return displayPoints(trafficSignals, map, {
        sourceId: "trafficSignals",
        width: 6,
        color: "#585858d5",
        popupFunc: setTrafficSignalPopUp
    });
}


export function displayIntersectionAggregate (_router: Router, data: FeatureCollection<LineString, GeoJsonProperties>, map: maplibregl.Map,
    sourceId: string, zoom: boolean = false, startMarker: boolean = true
) {
    return displayLineString(data, map, {
        sourceId: sourceId,
        startMarker: startMarker,
        sortKey: "numberOfRides",
        _router: _router,
        color: [
            'interpolate',
            ['linear'],
            ['get', 'medianWaitingTime'],
            0,  '#00ffb3ff',
            10, '#3cff00ff',
            30, '#fffb00ff',
            60, '#ff9900ff',
            120, '#ff0000ff'
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
        highlightWidth: [
            'interpolate',
            ['linear'],
            ['get', 'numberOfRides'],
            1, 2.0,
            2, 3.0,
            5, 4.0,
            10, 5.0,
            50, 7.0
        ],
        ...(zoom && { minzoom: 11 }),
        popupFunc: setIntersectionMetricsPopUp
    })
}

export function displayIntersection (_router: Router, data: FeatureCollection<LineString, GeoJsonProperties>, map: maplibregl.Map, 
    sourceId: string, zoom: boolean = false, startMarker: boolean = true
) {
    return displayLineString(data, map, {
        sourceId: sourceId,
        startMarker: startMarker,
        _router: _router,
        color: [
            'interpolate',
            ['linear'],
            ['get', 'waitingTime'],
            0,  '#00ffb3ff',
            10, '#3cff00ff',
            30, '#fffb00ff',
            60, '#ff9900ff',
            120, '#ff0000ff'
        ],
        ...(zoom && { minzoom: 11 }),
        popupFunc: setIntersectionBasePopUp
    });
}

export function displayRegions(data: FeatureCollection<Polygon, GeoJsonProperties>, map: maplibregl.Map, 
    sourceId: string, minzoom?:number, maxzoom?: number, filter?: any) {
    return displayPolygons(data, map, {
        sourceId: sourceId,
        minzoom: minzoom,
        maxzoom: maxzoom,
        color: [
            'interpolate',
            ['linear'],
            ['get', 'nodeWaitingSPerKm'],
            0,  '#00ffb3ff',
            5, '#3cff00ff',
            10, '#fffb00ff',
            20, '#ff9900ff',
            30, '#ff0000ff'
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
    });
}

export function zoomOnLineMidPoint(map: maplibregl.Map, data: FeatureCollection<LineString, GeoJsonProperties>) {
    const midPoint = calculateMidPoint(data.features[0].geometry);
    map.flyTo({ center: [midPoint[0], midPoint[1]], zoom: 16 });
}


export function removeQueryParamsForLineHighlight(_router: Router) {
    _router.navigate([], {
        queryParams: { "lng": null, "lat": null, "id": null, "zoom": null, "moveTo": false, "sourceId": null },
        queryParamsHandling: 'merge',
    });
}

export function highlightLine(map: maplibregl.Map, added: addedOnMap, sourceId: string, selectedId: number) {
    if (!selectedId || !sourceId) return;

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
        if (map.isSourceLoaded(sourceId)) {
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