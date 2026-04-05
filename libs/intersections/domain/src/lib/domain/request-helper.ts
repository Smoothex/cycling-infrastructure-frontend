import { DatePipe, DecimalPipe } from '@angular/common';
import { GeoJsonProperties, FeatureCollection, Feature, LineString, Polygon } from 'geojson';
import {
  linkLabelValue,
  NodeMetric,
  NodeMetricRow,
  EdgeMetric,
  EdgeMetricRow,
  RegionMetricRow,
  NodeRow,
  EdgeRow
} from '@simra/intersections-common';
import { along, length, centroid } from '@turf/turf';

function getLink (id: number, path: linkPrefixes) {
    const newLink: linkLabelValue = {
        label: `${id}`, 
        value: `/intersections/${path}/${id}`
    };
    return newLink;
}
function getMapLink (id: number) {
    const newLink: linkLabelValue = {
        label: `${id}`, 
        value: `/intersections/map`
    };
    return newLink;
}

function getLinkText(link: linkLabelValue) {
    return `<a href="${link.value}" class="link-button">${link.label}</a>`;
}

type linkPrefixes = "segment" | "node" | "edge" | "regions";
function setLink (prefix: linkPrefixes, properties: GeoJsonProperties, source: string, target: string) {
    if (properties?.[source]) {
        properties[target] = getLinkText(getLink(properties[source], prefix));
    }
}

function setTimeFormatted (properties: GeoJsonProperties, source: string, target: string) {
    if (properties?.[source]) {
        properties[target] = new DatePipe('en-US').transform(properties[source], 'dd/MM/yyyy HH:mm');
    }
}

function setDecimalFormatted (properties: GeoJsonProperties, source: string, target: string, decimalPlaces: number = 1) {
    if (properties?.[source]) {
        properties[target] = new DecimalPipe('en-US').transform(properties[source], `1.0-${decimalPlaces}`);
    }
}

function addSpaceIntoName(name: string) {
    return name.replaceAll(";", "; ");
}
function addSpaceIntoNameGeojson (properties: GeoJsonProperties, source: string, target: string) {
    if (properties?.[source]) {
        properties[target] = addSpaceIntoName(properties[source]);
    }
}

export function setPopUpTrafficSignal(props: GeoJsonProperties) {
    if (!props) return;
    props["header"] = "Traffic Signal";
}
export function setPopUpTrafficSignalCluster(props: GeoJsonProperties) {
    if (!props) return;
    props["header"] =  "Traffic Signal Intersection";
    setLink("node", props, "id", "Id");
}
export function setPopUpMatchedPoints(props: GeoJsonProperties) {
    if (!props) return;
    props["header"] =  "Matched Location";
    setLink("segment", props, "intersectionId", "IntersectionId");
    setTimeFormatted(props, "timestamp", "Time");
    setDecimalFormatted(props, "distanceFromTracePoint", "DistanceRidePoint");
    setDecimalFormatted(props, "accuracy", "AccuracyGPS");
}
export function setPopUpRidePoints(props: GeoJsonProperties) {
    if (!props) return;
    props["header"] =  "GPS Location";
    setTimeFormatted(props, "timestamp", "Time");
    if (props?.["path"]) {
        const pathParts = props["path"].split("/");
        props["File"] = pathParts[pathParts.length -1];
    }
}
export function setPopUpIntersectionBase(props: GeoJsonProperties) {
    if (!props) return;
    props["header"] =  "Segment";
    setLink("segment", props, "id", "Id");
    setLink("segment", props, "nextIntersectionId", "NextSegmentId");
    setLink("segment", props, "prevIntersectionId", "PrevSegmentId");
    setTimeFormatted(props, "startTime", "Start");
    setLink("node", props, "trafficSignalClusterId", "IntersectionId");
    setDecimalFormatted(props, "speed", "Speed");
    setDecimalFormatted(props, "duration", "Duration");
    setDecimalFormatted(props, "waitingTime", "WaitingTime");
}
export function setPopUpIntersectionMetrics(props: GeoJsonProperties) {
    if (!props) return;
    props["header"] = props["trafficSignalClusterId"] ? "Intersection" : "Way";
    setLink("segment", props, "id", "SegmentId");
    setLink("edge", props, "osmId", "Id");
    setLink("node", props, "trafficSignalClusterId", "Id");
    setDecimalFormatted(props, "avgSpeed", "MeanSpeed");
    setDecimalFormatted(props, "avgDuration", "MeanDuration");
    setDecimalFormatted(props, "avgWaitingTime", "MeanWaitingTime");
    setDecimalFormatted(props, "avgWaitingTimeWhenStopped", "MeanWaitingTimeStopped");
    setDecimalFormatted(props, "stopRate", "StopRate");
    addSpaceIntoNameGeojson(props, "streetNames", "streetNames");
}
export function setPopUpRegion(props: GeoJsonProperties) {
    if (!props) return;
    props["header"] =  "Region";
    setLink("regions", props, "id", "Id");
    setDecimalFormatted(props, "nodesPerKm", "NodesPerKm", 2);
    setDecimalFormatted(props, "nodeWaitingRate", "NodeWaiting%", 2);
    setDecimalFormatted(props, "nodeAvgWaitingTime", "NodeWaitingAvg", 2);
    setDecimalFormatted(props, "nodeWaitingSPerKm", "NodeWaitingSPerKm", 2);
    setDecimalFormatted(props, "edgeWaitingSPerKm", "EdgeWaitingSPerKm", 2);
}

function cleanIntersectionNodeMetricsProperties(row: NodeMetricRow) {
    row.trafficSignalClusterLink = getLink(row.trafficSignalClusterId, "node");
    row.segmentLink = getLink(row.id, "segment");
    row.streetNames = addSpaceIntoName(row.streetNames);
    return row;
}
function cleanIntersectionEdgeMetricsProperties(row: EdgeMetricRow) {
    if (row.osmId) row.osmLink = getLink(row.osmId, "edge");
    row.segmentLink = getLink(row.id, "segment");
    return row;
}
function cleanRegionMetricsProperties(row: RegionMetricRow) {
    row.regionIdLink = getLink(row.id, "regions");
    return row;
}
function calculateMidPoint(line: Feature<LineString>) {
    const midpoint = along(line, length(line) / 2);
    const center = midpoint.geometry.coordinates;
    return center;
}
function getZoomLineFeature(data: Feature<LineString>) {
    const midPoint = calculateMidPoint(data);
    return { lng: midPoint[0], lat: midPoint[1], zoom: 16};
}

export function processIntersectionNodeMetricsProperties(props: NodeMetric[]) {
    return props.map(n => cleanIntersectionNodeMetricsProperties(<NodeMetricRow> n));
}
export function processIntersectionEdgeMetricsProperties(props: EdgeMetric[]) {
    return props.map(e => cleanIntersectionEdgeMetricsProperties(<EdgeMetricRow> e));
}
export function processRegionMetricsProperties(props: RegionMetricRow[]) {
    return props.map(r => cleanRegionMetricsProperties(r));
}

export function mapFeaturesToNodeMetricRows(fc: FeatureCollection<LineString>): NodeMetricRow[] {
    return fc.features.map(f => {
        const nodeMetricRow = cleanIntersectionNodeMetricsProperties(<NodeMetricRow> f.properties);
        nodeMetricRow.midPoint = calculateMidPoint(f);

        nodeMetricRow.mapLinkSegment = {
            ...getMapLink(nodeMetricRow.id),
            params: {
                ...getZoomLineFeature(f),
                id: nodeMetricRow.id,
                sourceId: 'node-metrics'
            }
        }

        nodeMetricRow.mapLinktrafficSignalCluster = {
            ...getMapLink(nodeMetricRow.trafficSignalClusterId),
            params: getZoomLineFeature(f)
        }

        return nodeMetricRow;
    });
}
export function mapFeaturesToEdgeMetricRows(fc: FeatureCollection<LineString>): EdgeMetricRow[] {
    return fc.features.map(f => {
        const edgeMetricRow = cleanIntersectionEdgeMetricsProperties(<EdgeMetricRow> f.properties);
        edgeMetricRow.midPoint = calculateMidPoint(f);

        edgeMetricRow.mapLinkSegment = {
            ...getMapLink(edgeMetricRow.id),
            params: {
                ...getZoomLineFeature(f),
                id: edgeMetricRow.id,
                sourceId: 'edge-metrics'
            }
        }

        if (edgeMetricRow.osmId) {
            edgeMetricRow.mapLinkOsm = {
                ...getMapLink(edgeMetricRow.osmId),
                params: getZoomLineFeature(f)
            }
        }

        return edgeMetricRow;
    });
}
export function mapFeaturesToRegionMetricRows(fc: FeatureCollection<Polygon>): RegionMetricRow[] {
    return fc.features.map(f => {
        const regionMetricRow = cleanRegionMetricsProperties(<RegionMetricRow> f.properties);
        regionMetricRow.midPoint = centroid(f).geometry.coordinates;

        regionMetricRow.mapLink = {
            ...getMapLink(regionMetricRow.id),
            params: {
                zoom: regionMetricRow.adminLevel === 4 ? 7 : 9,
                lng: regionMetricRow.midPoint[0], lat: regionMetricRow.midPoint[1]
            }
        }

        return regionMetricRow;
    });
}
export function mapFeaturesToNodeRows(fc: FeatureCollection<LineString>): NodeRow[] {
    return fc.features.map(f => {
        const node = <NodeRow> f.properties;
        node.nodeLink = getMapLink(node.rideId);
        node.nodeLink.params = {
            ...getZoomLineFeature(f),
            id: node.id,
            sourceId: `intersectionNodes-${node.rideId}`
        }
        node.midPoint = calculateMidPoint(f);
        return node;
    })
}
export function mapFeaturesToEdgeRows(fc: FeatureCollection<LineString>): EdgeRow[] {
    return fc.features.map(f => {
        const edge = <EdgeRow> f.properties;
        edge.edgeLink = getMapLink(edge.rideId);
        edge.edgeLink.params = {
            ...getZoomLineFeature(f),
            id: edge.id,
            sourceId: `intersectionEdges-${edge.rideId}`
        }
        edge.midPoint = calculateMidPoint(f);
        return edge;
    })
}
