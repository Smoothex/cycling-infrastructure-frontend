import { Chart, registerables, ChartData, ChartOptions } from 'chart.js';
import { BoxPlotController, BoxAndWiskers } from '@sgratzl/chartjs-chart-boxplot';
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';
import { interpolateInferno } from 'd3-scale-chromatic';
import 'chartjs-adapter-date-fns';
import {
    Base,
    BaseMetric,
	ChartConfig
} from '@simra/intersections-common';

Chart.register(...registerables, BoxPlotController, BoxAndWiskers, MatrixController, MatrixElement);


export const BASE_CHART_CONFIG: ChartConfig<Base> = {
    selectableProperties: [
        {
            value: 'waitingTime',
            label: "Waiting Time (s)"
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
    ],
    defaultProperty: 'waitingTime',
    defaultProperty2: 'medianRideSpeed'
};
export const BASE_METRIC_CHART_CONFIG: ChartConfig<BaseMetric> = {
    selectableProperties: [
        {
            value: 'numberOfRides',
            label: "Number of Rides (#)"
        },
        {
            value: 'medianLength',
            label: "Median Length (m)"
        },
        {
            value: 'medianDuration',
            label: "Median Duration (s)"
        },
        {
            value: 'medianSpeed',
            label: "Median Speed (km/h)"
        },
        {
            value: 'medianWaitingTime',
            label: "Median Waiting Time (s)"
        },
        {
            value: 'maxWaitingTime',
            label: "Max Waiting Time (s)"
        },
    ],
    defaultProperty: 'medianWaitingTime',
    defaultProperty2: 'numberOfRides'
};


export function createHistogram(
    data: number[], 
    bucketSize: number, 
    offset: number,
    xLabel: string, 
    yLabel: string
) : { chart: ChartData<'bar'>; options: ChartOptions<'bar'>} {
    if (!data || data.length === 0) return { chart: { datasets: [] }, options: {} };

    const min = Math.floor((Math.min(...data) - offset) / bucketSize) * bucketSize + offset;
    const max = Math.ceil((Math.max(...data) - offset) / bucketSize) * bucketSize + offset;

    const bucketCount = Math.max(1, Math.ceil((max - min) / bucketSize));
    const buckets = new Array(bucketCount).fill(0);

    data.forEach(d => {
        let index = Math.floor((d - min) / bucketSize);
        if (index < 0) index = 0;
        if (index >= bucketCount) index = bucketCount - 1;
        buckets[index]++;
    });

    const labels = buckets.map((_, i) => {
        const start = min + i * bucketSize;
        const end = start + bucketSize;
        return `${start}–${end}`;
    });

    const result = {
        chart: {
            labels,
            datasets: [{ data: buckets }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false }},
            scales: {
                x: { title: { display: true, text: xLabel } },
                y: { title: { display: true, text: yLabel }, ticks: { precision: 0 } }
            }
        }
    }
    return result;
}



function getLines (
    sortedData: any[], 
    xKey: string, 
    yKey: string, 
    windowSize: number
) {
    return sortedData.map((_, index) => {
        const start = Math.max(0, index - windowSize);
        const end = Math.min(sortedData.length, index + windowSize + 1);
        const window = sortedData.slice(start, end).map(d => d[yKey]).sort((a, b) => a - b);
        const median = window[Math.floor(window.length / 2)];
        const average = window.reduce((a, b) => a + b, 0) / window.length;

        return {
            median : { x: sortedData[index][xKey], y: median },
            average: { x: sortedData[index][xKey], y: average }
        };
    });
}

export function createScatterPlotDate(
    data: any[], 
    xKey: string, 
    yKey: string, 
    windowSize: number, 
    yLabel: string
) : { chart: ChartData<'line' | 'scatter'>; options: ChartOptions<'line' | 'scatter'>}{
    if (!data || data.length === 0) return { chart: { datasets: [] }, options: {} };

    const sortedData = [...data].sort((a, b) => a[xKey].getTime() - b[xKey].getTime());
    const scatterPoints = sortedData.map(d => ({
        x: d[xKey],
        y: d[yKey]
    }));

    const lines = getLines(sortedData, xKey, yKey, windowSize);

    const medianLine = lines.map((l) => l.median);
    const avgLine = lines.map((l) => l.average);

    return {
        chart: {
            datasets: [
                {
                    label: `Moving Median (Window: ${windowSize*2+1})`,
                    type: 'line',
                    data: medianLine,
                    borderColor: '#42A5F5',
                    borderWidth: 3,
                    pointRadius: 0, // Hide points on the median line
                },
                {
                    label: `Moving Average (Window: ${windowSize*2+1})`,
                    type: 'line',
                    data: avgLine,
                    borderColor: '#338f33',
                    borderWidth: 3,
                    pointRadius: 0,
                },
                {
                    label: yLabel,
                    type: 'scatter',
                    data: scatterPoints,
                    backgroundColor: 'rgba(150, 150, 150, 0.3)',
                    pointRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: 'time',
                    time: { unit: 'month' },
                    title: { display: true, text: 'Date' }
                },
                y: {
                    title: { display: true, text: yLabel }
                }
            },
            plugins: {
            }
        }
    };
}

export function createScatterPlot(
    data: any[], 
    xKey: string, 
    yKey: string, 
    xLabel: string, 
    yLabel: string,
    windowSize: number
) : { chart: ChartData<'line' | 'scatter'>; options: ChartOptions<'line' | 'scatter'>} {
    if (!data || data.length === 0) return { chart: { datasets: [] }, options: {} };

    const sortedData = [...data].sort((a, b) => a[xKey] - b[xKey]);
    const scatterPoints = sortedData.map(d => ({
        x: d[xKey],
        y: d[yKey]
    }));

    const lines = getLines(sortedData, xKey, yKey, windowSize);

    const medianLine = lines.map((l) => l.median);
    const avgLine = lines.map((l) => l.average);

    
    return {
        chart: {
            datasets: [
                {
                    label: `Moving Median (Window: ${windowSize*2+1})`,
                    type: 'line',
                    data: medianLine,
                    borderColor: '#42A5F5',
                    borderWidth: 3,
                    pointRadius: 0, // Hide points on the median line
                },
                {
                    label: `Moving Average (Window: ${windowSize*2+1})`,
                    type: 'line',
                    data: avgLine,
                    borderColor: '#338f33',
                    borderWidth: 3,
                    pointRadius: 0,
                },
                {
                    label: yLabel,
                    type: 'scatter',
                    data: scatterPoints,
                    backgroundColor: 'rgba(150, 150, 150, 0.3)',
                    pointRadius: 4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    title: { display: true, text: xLabel }
                },
                y: {
                    title: { display: true, text: yLabel }
                }
            },
            plugins: {
            }
        }
    };
}


export function createBarChartForMetric<T>(
    data: T[], 
    categoryKey: keyof T, 
    valueKey: keyof T,
    xLabel: string, 
    xLabelTranslation: Record<string, string>,
    yLabel: string
) : { chart: ChartData<'bar'>; options: ChartOptions<'bar'>} {
    if (!data || data.length === 0) return { chart: { datasets: [] }, options: {} };

    const groups: Record<string, number> = {};

    data.forEach(item => {
        const cat = String(item[categoryKey]);
        const val = Number(item[valueKey]);
        groups[cat] = val;
    });

    const categories = Object.keys(groups);
    const labels = categories.map(c => xLabelTranslation[c]);
    const datasetData = categories.map(c => groups[c]);

    return {
        chart: {
            labels: labels,
            datasets: [{ data: datasetData }]
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false }},
            scales: {
                x: { title: { display: true, text: xLabel } },
                y: { title: { display: true, text: yLabel }, ticks: { precision: 0 } }
            }
        }
    }
}


export function createBoxPlot<T>(
    data: T[], 
    categoryKey: keyof T, 
    valueKey: keyof T,
    xLabel: string, 
    xLabelTranslation: Record<string, string>,
    yLabel: string
): { chart: ChartData<'boxplot'>; options: ChartOptions<'boxplot'>} {
    if (!data || data.length === 0) return { chart: { datasets: [] }, options: {} };

    const groups: Record<string, number[]> = {};
    data.forEach(item => {
        const cat = String(item[categoryKey]);
        const val = Number(item[valueKey]);
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(val);
    });

    const categories = Object.keys(groups);
    const labels = categories.map(c => xLabelTranslation[c]);
    const datasetData = categories.map(c => groups[c]);

    return {
        chart: {
            labels: labels,
            datasets: [{
                label: yLabel,
                data: datasetData,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgb(54, 162, 235)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { title: { display: true, text: xLabel } },
                y: { title: { display: true, text: yLabel }, beginAtZero: true }
            }
        }
    };
}


export function createHeatmapBinning(
    data: any[],
    xKey: string,
    yKey: string,
    xLabel: string,
    yLabel: string,
    bucketSizeX: number,
    bucketSizeY: number,
    offsetX: number = 0,
    offsetY: number = 0
): { chart: ChartData<'matrix'>; options: ChartOptions<'matrix'>; minCount: number; maxCount: number } {
    if (!data || data.length === 0) return { chart: { datasets: [] }, options: {}, minCount: 0, maxCount: 0 };
    // 1. Find Min/Max to define the grid boundaries
    const xValues = data.map(d => (d[xKey] instanceof Date ? d[xKey].getTime() : d[xKey]));
    const yValues = data.map(d => d[yKey]);

    const minX = Math.floor((Math.min(...xValues) - offsetX) / bucketSizeX) * bucketSizeX + offsetX;
    const maxX = Math.ceil((Math.max(...xValues) - offsetX) / bucketSizeX) * bucketSizeX + offsetX;
    
    const minY = Math.floor((Math.min(...yValues) - offsetY) / bucketSizeY) * bucketSizeY + offsetY;
    const maxY = Math.ceil((Math.max(...yValues) - offsetY) / bucketSizeY) * bucketSizeY + offsetY;

    const binsX = Math.max(1, Math.round((maxX - minX) / bucketSizeX));
    const binsY = Math.max(1, Math.round((maxY - minY) / bucketSizeY));

    // 2. Initialize the grid
    const grid: Record<string, { x: number, y: number, v: number }> = {};

    data.forEach(d => {
        const valX = d[xKey] instanceof Date ? d[xKey].getTime() : d[xKey];
        const valY = d[yKey];

        let binX = Math.floor((valX - minX) / bucketSizeX);
        let binY = Math.floor((valY - minY) / bucketSizeY);
        
        binX = Math.min(Math.max(binX, 0), binsX - 1);
        binY = Math.min(Math.max(binY, 0), binsY - 1);
        
        const key = `${binX}-${binY}`;

        if (!grid[key]) {
            // Store the exact CENTER of the bin so the matrix plugin centers the square
            grid[key] = { 
                x: minX + (binX * bucketSizeX) + (bucketSizeX / 2), 
                y: minY + (binY * bucketSizeY) + (bucketSizeY / 2),
                v: 0,
            };
        }
        grid[key].v++;
    });

    const matrixData = Object.values(grid);
    const maxCount = Math.max(...matrixData.map(d => d.v));
    const minCount = Math.min(...matrixData.map(d => d.v));

    return {
        chart: {
            datasets: [{
                data: matrixData as any,
                width: (ctx: any) => {
                    const chart = ctx.chart;
                    const scale = chart.scales.x;
                    if (!scale) return 0;
                    // Pixel distance of one bucket minus 1px for a small visual gap
                    return Math.abs(scale.getPixelForValue(minX + bucketSizeX) - scale.getPixelForValue(minX)) - 1; 
                },
                height: (ctx: any) => {
                    const chart = ctx.chart;
                    const scale = chart.scales.y;
                    if (!scale) return 0;
                    return Math.abs(scale.getPixelForValue(minY + bucketSizeY) - scale.getPixelForValue(minY)) - 1;
                },
                backgroundColor: (ctx: any) => {
                    const value = ctx.dataset.data[ctx.dataIndex]?.v || 0;

                    const range = maxCount - minCount || 1;
                    const normalized = (maxCount - value) / range;

                    return interpolateInferno(normalized);
                },
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                    type: xKey === 'startTime' ? 'time' : 'linear',
                    title: { display: true, text: xLabel },
                    min: minX,
                    max: maxX,
                    offset: false,
                    grid: {
                        display: true,
                        offset: false 
                    },
                    ...(xKey !== 'startTime' && {
                        ticks: {
                            stepSize: bucketSizeX 
                        }
                    }),
                    ...(xKey === 'startTime' && {
                        time: {
                            unit: 'month', 
                            displayFormats: {
                                day: 'MMM YYYY'
                            }
                        }
                    })
                },
                y: {
                    type: 'linear',
                    title: { display: true, text: yLabel },
                    min: minY,
                    max: maxY,
                    offset: false,
                    reverse: false, 
                    grid: {
                        display: true,
                        offset: false 
                    },
                    ticks: {
                        stepSize: bucketSizeY // This forces the grid lines to strictly align with the bin edges
                    }
                }
            },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        // Added a nice touch to show the data range of the bin in the tooltip
                        title: (context: any) => {
                            const d = context[0].raw;
                            const x0 = Number((d.x - bucketSizeX/2).toFixed(2));
                            const x1 = Number((d.x + bucketSizeX/2).toFixed(2));
                            const y0 = Number((d.y - bucketSizeY/2).toFixed(2));
                            const y1 = Number((d.y + bucketSizeY/2).toFixed(2));
                            return `X: ${x0}–${x1} | Y: ${y0}–${y1}`;
                        },
                        label: (context: any) => `Count: ${context.raw.v}`
                    }
                }
            }
        },
        minCount: minCount,
        maxCount: maxCount
    };
}