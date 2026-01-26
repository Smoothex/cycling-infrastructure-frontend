import { Feature, FeatureCollection, GeoJsonProperties, LineString, Point, Polygon } from 'geojson';
import { along, length } from '@turf/turf';
import * as maplibregl from 'maplibre-gl';
import { IntersectionsAggregateFacade } from '@simra/intersections-domain';
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

export function renameProperty(collection: FeatureCollection, sourceName: string, targetName: string) {
    for (const feature of collection.features) {
        if (!feature.properties) continue;
        if (feature.properties[sourceName]) {
            feature.properties[targetName] = feature.properties[sourceName];
            delete feature.properties[sourceName];
        }
    }
}

export interface displayOptions {
    sourceId: string; 
    color: any;
    visible: boolean;
    minzoom?: number;
    maxzoom?: number;
}

function zoomProps(opts: { minzoom?: number; maxzoom?: number }) {
    return {
        ...(opts.minzoom !== undefined && { minzoom: opts.minzoom }),
        ...(opts.maxzoom !== undefined && { maxzoom: opts.maxzoom }),
    };
}

export interface displayOptionsPoint extends displayOptions {
    popupFunc?: Function;
    width: any;
}

export function displayPoints(points: FeatureCollection<Point>, map: maplibregl.Map, options: displayOptionsPoint) {
    const visible = options.visible ? 'visible' : 'none';
    const popupFunc = options.popupFunc ?? setDefaultPopUp;
    const layerId = options.sourceId + '-layer';

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
    map.setLayoutProperty(layerId, 'visibility', visible);
    map.on('click', layerId, e => {
        const properties = e.features?.[0].properties;
        if (properties) {
            popupFunc(map, e.lngLat, properties);
        }
    });
}

export interface displayOptionsPolygon extends displayOptions {
    popupFunc?: Function;
    outlineWidth?: any;
    filter?: any;
}

export function displayPolygons(polygons: FeatureCollection<Polygon>, map: maplibregl.Map, options: displayOptionsPolygon) {
    const visible = options.visible ? 'visible' : 'none';
    const popupFunc = options.popupFunc ?? setDefaultPopUp;
    const layerId = options.sourceId + '-layer';
    const outlineLayerId = options.sourceId + '-outline-layer';
    
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
    map.setLayoutProperty(layerId, 'visibility', visible);
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
        map.setLayoutProperty(outlineLayerId, 'visibility', visible);
    }    
}

export interface displayOptionsLineString extends displayOptions {
    _router: Router;
    width?: any;
    highlightWidth?: any;
}

export function displayLineString(lineString: FeatureCollection<LineString>, map: maplibregl.Map, options: displayOptionsLineString) {
    const visible = options.visible ? 'visible' : 'none';
    const width = options.width ?? 2;
    const highlightWidth = options.highlightWidth ?? 3;

    const layerId = options.sourceId + '-layer';
    const highlightColorLayerId = options.sourceId + '-highlight-color';
    const highlightLayerId = options.sourceId + '-highlight';

    const startMarkerSource = options.sourceId + 'start';
    const startMarkerLayerId = options.sourceId + '-circle-layer';
    const startMarkerHighlightLayer = options.sourceId + '-start-layer';

    const startCoordinates = []
    for (let i = 0; i < lineString.features.length; i++) {
        const props = lineString.features[i].properties;
        if (props) {
            const start = lineString.features[i].geometry.coordinates[0];
            const p: Point = { "type": "Point", "coordinates": start};
            const f: Feature<Point> = {"type": "Feature", "geometry": p, "properties": props};
            startCoordinates.push(f);
        }
    }

    const startFeature:FeatureCollection<Point> = {
        type: 'FeatureCollection',
        features: startCoordinates,
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
        ...zoomProps(options)
    });
    map.setLayoutProperty(layerId, 'visibility', visible);
    MapUtils.changeCursor(map, layerId);
    map.on('click', layerId, e => {
        const properties = e.features?.[0].properties;
        if (properties) {
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
        filter: ['==', ['get', "id"], ''],
        ...zoomProps(options)
    });

    map.addLayer({
        id: highlightLayerId,
        type: 'line',
        source: options.sourceId,
        paint: {
            'line-color': '#000000ff',
            'line-width': highlightWidth,
            'line-gap-width':  width,
        },
        filter: ['==', ['get', 'id'], ''],
        ...zoomProps(options)
    });

    map.addSource(startMarkerSource, {
        type: 'geojson',
        data: startFeature,
    });

    map.addLayer({
        id: startMarkerLayerId,
        type: 'circle',
        source: startMarkerSource,
        paint: {
            'circle-color': options.color,
            'circle-radius': 5,
        },
        ...zoomProps(options)
    })
    map.setLayoutProperty(startMarkerLayerId, 'visibility', visible);
    MapUtils.changeCursor(map, startMarkerLayerId);
    map.on('click', startMarkerLayerId, e => {
        const properties = e.features?.[0].properties;
        if (properties) {
            applyQueryParamsForLineHighlight(options._router, properties['id'], e.lngLat.lat, e.lngLat.lng, false, options.sourceId);
        }
    });

    map.addLayer({
        id: startMarkerHighlightLayer,
        type: 'circle',
        source: startMarkerSource,
        paint: {
            'circle-color': '#000000ff',
            'circle-radius': 7,
        },
        filter: ['==', ['get', 'id'], ''],
        ...zoomProps(options)
    })

    removeLineHighlightOnDblclick(options._router, map, options.sourceId);
}

function getLineHighlightLayers(sourceId: string) : string[] {
    const lineHighlightLayers = [
        `${sourceId}-highlight-color`,
        `${sourceId}-highlight`,
        `${sourceId}-start-layer`
    ]

    return lineHighlightLayers;
}

export function setPopUp(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, unknown>, keys: string[], header: string = "") {
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

export function setDefaultPopUp(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, unknown>) {
    setPopUp(mlMap, lngLat, properties, Object.keys(properties));
}

export function setTrafficSignalClusterPopUp(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: Record<string, unknown>) {
    setPopUp(mlMap, lngLat, properties, ["id"], "Intersection");
}

export function setTrafficSignalPopUp(mlMap: maplibregl.Map, lngLat: maplibregl.LngLat, properties: {[name: string]: any;}) {
    setPopUp(mlMap, lngLat, properties, ["id"], "Traffic Signal");
}


function removeLineHighlightOnDblclick(_router: Router, map: maplibregl.Map, sourceId: string) {
    map.on('dblclick', e => {
        removeQueryParamsForLineHighlight(_router);
        removeLineHighlight(map, sourceId);
    });
}

export function removeLineHighlight(map: maplibregl.Map, sourceId: string) {
    for (const layer of getLineHighlightLayers(sourceId)) {
        map.setFilter(layer, [
            '==',
            ['get', 'id'],
            ""
        ])
    }
}

export async function displayTrafficSignalPolygons(map: maplibregl.Map, trafficSignalClusters: FeatureCollection<Polygon, GeoJsonProperties>, zoom: boolean = false) {
    displayPolygons(trafficSignalClusters, map, {
        sourceId: "trafficSignalClustersPolygons",
        visible: true,
        color: "#b1b1b1d5",
        popupFunc: setTrafficSignalClusterPopUp,
        ...(zoom && { minzoom: 11 })
    });
}

export async function loadAndDisplayTrafficSignalPolygonsByTrafficSignalClusterId(_intersectionsAggregateFacade: IntersectionsAggregateFacade, map: maplibregl.Map, trafficSignalClusterId: number) {
    const trafficSignalClusterPolygons = await _intersectionsAggregateFacade.getTrafficSignalPolygonsByTrafficSignalClusterId(trafficSignalClusterId);
    displayTrafficSignalPolygons(map, trafficSignalClusterPolygons);
}


export async function displayTrafficSignals(map: maplibregl.Map, trafficSignals: FeatureCollection<Point, GeoJsonProperties>, zoom: boolean = false) {
    displayPoints(trafficSignals, map, {
        sourceId: "trafficSignals",
        width: 6,
        visible: true,
        color: "#585858d5",
        popupFunc: setTrafficSignalPopUp,
        ...(zoom && { minzoom: 11 })
    });
}

export async function loadDisplayAndZoomTrafficSignalsByTrafficSignalClusterId(_intersectionsAggregateFacade: IntersectionsAggregateFacade, map: maplibregl.Map, trafficSignalClusterId: number) {
    const trafficSignals = await _intersectionsAggregateFacade.getTrafficSignalsByTrafficSignalClusterId(trafficSignalClusterId);
    displayPoints(trafficSignals, map, {
        sourceId: "trafficSignals",
        width: 6,
        visible: true,
        color: "#585858d5",
        popupFunc: setTrafficSignalPopUp
    });

    const coordiante = trafficSignals.features[0].geometry.coordinates;
    map.flyTo({ center: [coordiante[0], coordiante[1]], zoom: 16 });
}


export function displayIntersectionAggregate (_router: Router, data: FeatureCollection<LineString, GeoJsonProperties>, map: maplibregl.Map, sourceId: string, zoom: boolean = false) {
    displayLineString(data, map, {
        sourceId: sourceId,
        visible: true,
        _router: _router,
        color: [
            'interpolate',
            ['linear'],
            ['get', 'median_waiting_time'],
            0,  '#00ffb3ff',
            10, '#3cff00ff',
            30, '#fffb00ff',
            60, '#ff9900ff',
            120, '#ff0000ff'
        ],
        width: [
            'interpolate',
            ['linear'],
            ['get', 'count'],
            1, 1.0,
            2, 2.0,
            5, 3.0,
            10, 4.0,
            50, 6.0
        ],
        highlightWidth: [
            'interpolate',
            ['linear'],
            ['get', 'count'],
            1, 2.0,
            2, 3.0,
            5, 4.0,
            10, 5.0,
            50, 7.0
        ],
        ...(zoom && { minzoom: 11 })
    })
}

export function displayIntersection (_router: Router, data: FeatureCollection<LineString, GeoJsonProperties>, map: maplibregl.Map, sourceId: string, zoom: boolean = false) {
    displayLineString(data, map, {
        sourceId: sourceId,
        visible: true,
        _router: _router,
        color: [
            'interpolate',
            ['linear'],
            ['get', 'waiting_time'],
            0,  '#00ffb3ff',
            10, '#3cff00ff',
            30, '#fffb00ff',
            60, '#ff9900ff',
            120, '#ff0000ff'
        ],
        ...(zoom && { minzoom: 11 })
    });
}

export function displayRegions(data: FeatureCollection<Polygon, GeoJsonProperties>, map: maplibregl.Map, 
    sourceId: string, minzoom?:number, maxzoom?: number, filter?: any) {
    displayPolygons(data, map, {
        sourceId: sourceId,
        visible: true,
        minzoom: minzoom,
        maxzoom: maxzoom,
        color: [
            'interpolate',
            ['linear'],
            ['get', 'node_waiting_s_per_km'],
            0,  '#00ffb3ff',
            5, '#3cff00ff',
            10, '#fffb00ff',
            20, '#ff9900ff',
            30, '#ff0000ff'
        ],
        outlineWidth: [
            'interpolate',
            ['linear'],
            ['get', 'number_of_rides'],
            10, 1.0,
            50, 3.0,
            500, 10.0
        ],
        filter: filter
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

export function highlightLineFromQueryParams(params: Params, map: maplibregl.Map): boolean {
    const selectedId: number = Number(params["id"]);
    const lng: number = Number(params["lng"]);
    const lat: number = Number(params["lat"]);
    const sourceId: string = params["sourceId"];

    if (!selectedId || !lat || !lng || !sourceId) return false;

    // Make highlight layer visible for specified id
    for (const layer of getLineHighlightLayers(sourceId)) {
        if (map.getLayer(layer)) {
            map.setFilter(layer, [
                '==',
                ['get', "id"],
                selectedId
            ]);
        } else {
            return false;
        }
    }

    const features = map.querySourceFeatures(sourceId, {
        filter: ["==", ["get", "id"], selectedId]
    });
    
    if (features.length > 0) {
        // Display PopUp for specified id
        const lngLat = new maplibregl.LngLat(lng, lat);
        setDefaultPopUp(map, lngLat, features[0].properties);

        return true;
    }
    console.warn("Source not found: ", sourceId);
    return false;
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