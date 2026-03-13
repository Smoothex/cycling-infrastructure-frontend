import { DatePipe, DecimalPipe } from '@angular/common';
import { FeatureCollection, Point, LineString, Polygon, GeoJsonProperties } from 'geojson';
import {
  linkLabelValue,
  cleanRegionMetric,
  RawRegionMetric
} from '@simra/intersections-common';

function getLink (id: string, path: string) {
    const newLink: linkLabelValue = {
        label: id, 
        value: `/intersections/${path}/${id}`
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

export function processTrafficSignal (fc: FeatureCollection<Point>) {
    for (const feature of fc.features) {
        const props = feature.properties;
        if (!props) continue;
        props["header"] =  "Traffic Signal";
    }
}

export function processTrafficSignalCluster (fc: FeatureCollection<Polygon>) {
    for (const feature of fc.features) {
        const props = feature.properties;
        if (!props) continue;
        props["header"] =  "Traffic Signal Intersection";
        setLink("node", props, "id", "Id");
    }
}

export function processMatchedPoints (fc: FeatureCollection<Point>) {
    for (const feature of fc.features) {
        const props = feature.properties;
        if (!props) continue;
        props["header"] =  "Matched Location";
        setLink("segment", props, "intersectionId", "IntersectionId");
        setTimeFormatted(props, "timestamp", "Time");
        setDecimalFormatted(props, "distanceFromTracePoint", "DistanceRidePoint");
        setDecimalFormatted(props, "accuracy", "AccuracyGPS");
    }
}

export function processRidePoints (fc: FeatureCollection<Point>) {
    for (const feature of fc.features) {
        const props = feature.properties;
        if (!props) continue;
        props["header"] =  "GPS Location";
        setTimeFormatted(props, "timestamp", "Time");
        if (props?.["path"]) {
            const pathParts = props["path"].split("/");
            props["File"] = pathParts[pathParts.length -1];
        }
    }
}

export function processIntersectionBase (fc: FeatureCollection<LineString>) {
    for (const feature of fc.features) {
        const props = feature.properties;
        if (!props) continue;
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
}

export function processIntersectionMetrics (fc: FeatureCollection<LineString>) {
    for (const feature of fc.features) {
        const props = feature.properties;
        if (!props) continue;
        props["header"] = props["trafficSignalClusterId"] ? "Intersection" : "Way";
        setLink("segment", props, "id", "SegmentId");
        setLink("edge", props, "osmId", "Id");
        setLink("node", props, "trafficSignalClusterId", "Id");
        setDecimalFormatted(props, "medianSpeed", "Speed");
        setDecimalFormatted(props, "medianDuration", "Duration");
        setDecimalFormatted(props, "medianWaitingTime", "WaitingTime");
    }
}

export function processRegion (fc: FeatureCollection<Polygon>) {
    for (const feature of fc.features) {
        const props = feature.properties;
        if (!props) continue;
        const cleaned = <GeoJsonProperties> cleanRegionMetric([<RawRegionMetric> props])[0];
        if (!cleaned) continue;
        feature.properties = cleaned;
        cleaned["header"] =  "Region";
        setLink("regions", cleaned, "id", "Id");
        setDecimalFormatted(cleaned, "nodeMedianWaitingTime", "NodeWaitingTime", 2);
        setDecimalFormatted(cleaned, "nodeWaitingSPerKm", "NodeWaitingSPerKm", 2);
        setDecimalFormatted(cleaned, "edgeWaitingSPerKm", "EdgeWaitingSPerKm", 2);
    }
}