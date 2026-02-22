import { DatePipe, DecimalPipe } from '@angular/common';
import { FeatureCollection, Point, LineString, Polygon, GeoJsonProperties } from 'geojson';
import {
  linkLabelValue
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


function setTrafficSignalClusterLink (properties: GeoJsonProperties, source: string, target: string) {
    if (properties?.[source]) {
        properties[target] = getLinkText(getLink(properties[source], "trafficSignalCluster"));
    }
}

function setBaseLink (properties: GeoJsonProperties, source: string, target: string) {
    if (properties?.[source]) {
        properties[target] = getLinkText(getLink(properties[source], "base"));
    }
}

function setMetricLink (properties: GeoJsonProperties, source: string, target: string) {
    if (properties?.[source]) {
        properties[target] = getLinkText(getLink(properties[source], "metric"));
    }
}

function setRegionLink (properties: GeoJsonProperties, source: string, target: string) {
    if (properties?.[source]) {
        properties[target] = getLinkText(getLink(properties[source], "regions"));
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


export function processTrafficSignalCluster (fc: FeatureCollection<Polygon>) {
    for (const feature of fc.features) {
        const props = feature.properties;
        setTrafficSignalClusterLink(props, "id", "Id");
    }
}

export function processMatchedPoints (fc: FeatureCollection<Point>) {
    for (const feature of fc.features) {
        const props = feature.properties;
        setBaseLink(props, "intersectionId", "IntersectionId");
        setTimeFormatted(props, "timestamp", "Time");
        setDecimalFormatted(props, "distanceFromTracePoint", "DistanceRidePoint");
        setDecimalFormatted(props, "accuracy", "AccuracyGPS");
    }
}

export function processRidePoints (fc: FeatureCollection<Point>) {
    for (const feature of fc.features) {
        const props = feature.properties;
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
        setBaseLink(props, "id", "Id");
        setBaseLink(props, "nextIntersectionId", "NextSegmentId");
        setBaseLink(props, "prevIntersectionId", "PrevSegmentId");
        setTimeFormatted(props, "startTime", "Start");
        setTrafficSignalClusterLink(props, "trafficSignalClusterId", "TrafficSignalClusterId");
        setDecimalFormatted(props, "speed", "Speed");
        setDecimalFormatted(props, "duration", "Duration");
        setDecimalFormatted(props, "waitingTime", "WaitingTime");
    }
}

export function processIntersectionMetrics (fc: FeatureCollection<LineString>) {
    for (const feature of fc.features) {
        const props = feature.properties;
        setBaseLink(props, "id", "SegmentId");
        setMetricLink(props, "osmId", "OsmId");
        setTrafficSignalClusterLink(props, "trafficSignalClusterId", "TrafficSignalClusterId");
        setDecimalFormatted(props, "medianSpeed", "Speed");
        setDecimalFormatted(props, "medianDuration", "Duration");
        setDecimalFormatted(props, "medianWaitingTime", "WaitingTime");
    }
}

export function processRegion (fc: FeatureCollection<Polygon>) {
    for (const feature of fc.features) {
        const props = feature.properties;
        setRegionLink(props, "regionId", "Id");
        setDecimalFormatted(props, "nodeMedianWaitingTime", "NodeWaitingTime", 2);
        setDecimalFormatted(props, "nodeWaitingSPerKm", "NodeWaitingSPerKm", 2);
        setDecimalFormatted(props, "edgeWaitingSPerKm", "EdgeWaitingSPerKm", 2);
    }
}