import {
    Base,
    BaseMetric,
	ChartConfig,
    RegionMetricData,
    RideRegionMetric,
    RegionMetric,
    SelectableProperty,
} from '@simra/intersections-common';

export const BASE_SELECTABLE_PROPERTIES: SelectableProperty<Base>[] = [
    {
        value: 'waitingTime',
        label: "Waiting (s)"
    }, 
    {
        value: 'duration',
        label: "Duration (s)"
    }, 
    {
        value: 'speed',
        label: "Speed (km/h)"
    }, 
    {
        value: 'medianRideSpeed',
        label: "Median Ride Speed (km/h)"
    }
];
export const BASE_CHART_CONFIG: ChartConfig<Base> = {
    selectableProperties: BASE_SELECTABLE_PROPERTIES,
    defaultProperty: 'waitingTime',
    defaultProperty2: 'medianRideSpeed',
    idKey: 'rideId',
    aggregationLabel: 'Number of Rides (#)'
};

export const BASE_METRIC_SELECTABLE_PROPERTIES: SelectableProperty<BaseMetric>[] = [
    {
        value: 'numberOfRides',
        label: "Number of Rides (#)"
    },
    {
        value: 'avgLength',
        label: "Avg. Length (m)"
    },
    {
        value: 'avgDuration',
        label: "Avg. Duration (s)"
    },
    {
        value: 'avgSpeed',
        label: "Avg. Speed (km/h)"
    },
    {
        value: 'avgWaitingTime',
        label: "Avg. Waiting (s)"
    },
    {
        value: 'avgWaitingTimeWhenStopped',
        label: "Avg. Waiting When Stopped (s)"
    },
    {
        value: 'stopRate',
        label: "Stop Rate (%)"
    },
    {
        value: 'maxWaitingTime',
        label: "Max. Waiting (s)"
    },
]
export const BASE_METRIC_CHART_CONFIG: ChartConfig<BaseMetric> = {
    selectableProperties: BASE_METRIC_SELECTABLE_PROPERTIES,
    defaultProperty: 'avgWaitingTime',
    defaultProperty2: 'numberOfRides',
    isAggregated: true,
    idKey: 'id',
    aggregationLabel: 'Number of Segments (#)'
};
export const NODE_METRIC_CHART_CONFIG: ChartConfig<BaseMetric> = {
    ...BASE_METRIC_CHART_CONFIG,
    canCompare: true
};

const REGION_METRIC_DATA_SELECTABLE_PROPERTIES: SelectableProperty<RegionMetricData>[] = [
    {
        value: 'nodesPerKm',
        label: "Intersection Density (#/km)"
    },
    {
        value: 'nodeAvgWaitingTime',
        label: "Intersection Avg. Waiting (s)"
    },
    {
        value: 'nodeAvgWaitingTimeWhenStopped',
        label: "Intersection Avg. Waiting When Stopped (s)"
    },
    {
        value: 'nodeStopRate',
        label: "Intersection Stop Rate (%)"
    },
    {
        value: 'nodeWaitingSPerKm',
        label: "Intersection Waiting (s/km)"
    },
    {
        value: 'nodeWaitingRate',
        label: "Intersection Waiting (%)"
    },
    {
        value: 'nodeWaitingTime',
        label: "Intersection Total Waiting (s)"
    },
    {
        value: 'edgeWaitingSPerKm',
        label: "Street Waiting (s/km)"
    },
    {
        value: 'edgeWaitingRate',
        label: "Street Waiting (%)"
    },
    {
        value: 'numberOfNodes',
        label: "Intersections (#)"
    },
    {
        value: 'length',
        label: "Length (km)"
    },
    {
        value: 'duration',
        label: "Duration (s)"
    }
]
export const RIDE_SELECTABLE_PROPERTIES: SelectableProperty<RideRegionMetric>[] = [
    ...REGION_METRIC_DATA_SELECTABLE_PROPERTIES,
    {
        value: 'medianRideSpeed',
        label: "Median Ride Speed (km/h)"
    }
]
export const RIDE_CHART_CONFIG: ChartConfig<RideRegionMetric> = {
    selectableProperties: RIDE_SELECTABLE_PROPERTIES,
    defaultProperty: 'nodeWaitingRate',
    defaultProperty2: 'length',
    idKey: 'rideId',
    aggregationLabel: 'Number of Rides (#)'
};

export const REGION_SELECTABLE_PROPERTIES: SelectableProperty<RegionMetric>[] = [
    {
        value: 'numberOfRides',
        label: "Number of Rides (#)"
    },
    ...REGION_METRIC_DATA_SELECTABLE_PROPERTIES
]
export const REGION_CHART_CONFIG: ChartConfig<RegionMetric> = {
    selectableProperties: REGION_SELECTABLE_PROPERTIES,
    defaultProperty: 'numberOfRides',
    defaultProperty2: 'length',
    isAggregated: true,
    idKey: 'id',
    aggregationLabel: ''
};


export function getLabelFromOptions <T> (options: SelectableProperty<T>[], value: keyof T) {
    for (const el of options) if (el.value === value) return el.label;
	return "";
}