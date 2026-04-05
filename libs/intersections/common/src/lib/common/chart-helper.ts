import { Chart, registerables, ChartData, ChartOptions } from 'chart.js';
import { BoxPlotController, BoxAndWiskers } from '@sgratzl/chartjs-chart-boxplot';
import { MatrixController, MatrixElement } from 'chartjs-chart-matrix';
import { interpolateInferno } from 'd3-scale-chromatic';
import 'chartjs-adapter-date-fns';

Chart.register(...registerables, BoxPlotController, BoxAndWiskers, MatrixController, MatrixElement);

export function createHistogram<T>(
    data: T[],
    key: keyof T,
    bucketSize: number, 
    offset: number,
    xLabel: string, 
    yLabel: string,
    minView?: number,
    maxView?: number
) : { chart: ChartData<'bar'>; options: ChartOptions<'bar'>; outliers: number;} {
    if (!data || data.length === 0) return { chart: { datasets: [] }, options: {}, outliers: 0 };

    const values = data.map(d => d[key]) as number[];

    const min = Math.floor(((minView ?? Math.min(...values)) - offset) / bucketSize) * bucketSize + offset;
    const max = Math.ceil(((maxView ??  Math.max(...values)) - offset) / bucketSize) * bucketSize + offset;

    const bucketCount = Math.max(1, Math.ceil((max - min) / bucketSize));
    const buckets = new Array(bucketCount).fill(0);

    let numberOfOutliers = 0;

    data.forEach(d => {
        const value = d[key] as number;
        const index = Math.floor((value - min) / bucketSize);
        const safeIndex = Math.min(Math.max(0, index), bucketCount - 1);
        
        if (value < min || value > max) numberOfOutliers += 1;
        buckets[safeIndex]++;
    });

    const labels = buckets.map((_, i) => {
        const start = min + i * bucketSize;
        const end = start + bucketSize;
        return `${start}–${end}`;
    });

    return {
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
        },
        outliers: numberOfOutliers
    }
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
    yLabel: string,
    displayAvgLine: boolean,
    displayMedianLine: boolean
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

    const chartData: ChartData<'line' | 'scatter'> = {
        datasets: [
        {
            label: yLabel,
            type: 'scatter',
            data: scatterPoints,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            pointRadius: 5
        }
    ]}
    if (displayAvgLine) {
        chartData.datasets.push({
            label: `Moving Average (Window: ${windowSize*2+1})`,
            type: 'line',
            data: avgLine,
            borderColor: '#338f33',
            borderWidth: 3,
            pointRadius: 0,
        })
    }
    if (displayMedianLine) {
        chartData.datasets.push({
            label: `Moving Median (Window: ${windowSize*2+1})`,
            type: 'line',
            data: medianLine,
            borderColor: '#42A5F5',
            borderWidth: 3,
            pointRadius: 0,
        })
    }
    return {
        chart: chartData,
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
                ...((!displayAvgLine && !displayMedianLine) && {legend: { display: false }})
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
    windowSize: number,
    displayAvgLine: boolean,
    displayMedianLine: boolean
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

    const chartData: ChartData<'line' | 'scatter'> = {
        datasets: [
        {
            label: yLabel,
            type: 'scatter',
            data: scatterPoints,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            pointRadius: 5
        }
    ]}
    if (displayAvgLine) {
        chartData.datasets.push({
            label: `Moving Average (Window: ${windowSize*2+1})`,
            type: 'line',
            data: avgLine,
            borderColor: '#338f33',
            borderWidth: 3,
            pointRadius: 0,
        })
    }
    if (displayMedianLine) {
        chartData.datasets.push({
            label: `Moving Median (Window: ${windowSize*2+1})`,
            type: 'line',
            data: medianLine,
            borderColor: '#42A5F5',
            borderWidth: 3,
            pointRadius: 0,
        })
    }
    return {
        chart: chartData,
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
                ...((!displayAvgLine && !displayMedianLine) && {legend: { display: false }})
            }
        }
    };
}


export function createBarChartForMetric<T>(
    data: T[], 
    categoryKey: keyof T, 
    valueKey: keyof T,
    xLabel: string, 
    categoryLabels: Record<string, string>,
    yLabel: string
) : { chart: ChartData<'bar'>; options: ChartOptions<'bar'>} {
    if (!data || data.length === 0) return { chart: { datasets: [] }, options: {} };

    const groups: Record<string, number> = {};

    data.forEach(item => {
        const cat = String(item[categoryKey]);
        const val = Number(item[valueKey]);
        groups[cat] = val;
    });

    const labels: string[] = [];
    const datasetData: number[] = [];
    for (const key of Object.keys(categoryLabels)) {
        if (groups[key]) {
            labels.push(categoryLabels[key]);
            datasetData.push(groups[key]);
        }
    }

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
    categoryLabels: Record<string, string>,
    yLabel: string,
    minView?: number,
    maxView?: number
): { chart: ChartData<'boxplot'>; options: ChartOptions<'boxplot'>; minValue: number; maxValue: number; } {
    if (!data || data.length === 0) return { chart: { datasets: [] }, options: {}, minValue: 0, maxValue: 0 };

    const actualMin = Math.min(...data.map((item) => Number(item[valueKey])));
    const actualMax = Math.max(...data.map((item) => Number(item[valueKey])));

    const groups: Record<string, number[]> = {};
    data.forEach(item => {
        const cat = String(item[categoryKey]);
        const val = Number(item[valueKey]);
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(val);
    });

    const labels: string[] = [];
    const datasetData: number[][] = [];
    for (const key of Object.keys(categoryLabels)) {
        if (groups[key]) {
            labels.push(categoryLabels[key]);
            datasetData.push(groups[key]);
        }
    }

    return {
        chart: {
            labels: labels,
            datasets: [{
                label: yLabel,
                data: datasetData,
                backgroundColor: 'rgba(54, 162, 235, 0.5)',
                borderColor: 'rgb(54, 162, 235)',
                borderWidth: 1,
                outlierRadius: 5,
                outlierBackgroundColor: 'rgba(0, 0, 0, 0.5)',
                meanRadius: 5,
                meanBackgroundColor: 'rgb(0, 0, 0)'
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { display: false }
            },
            scales: {
                x: { title: { display: true, text: xLabel } },
                y: { title: { display: true, text: yLabel }, min: minView, max: maxView }
            }
        },
        minValue: actualMin,
        maxValue: actualMax
    };
}


export function createHeatmapBinning(
    data: any[],
    xKey: string,
    yKey: string,
    idKey: string,
    xLabel: string,
    yLabel: string,
    bucketSizeX: number,
    bucketSizeY: number,
    offsetX: number = 0,
    offsetY: number = 0,
    minViewX?: number,
    maxViewX?: number,
    minViewY?: number,
    maxViewY?: number,
    maxViewCount?: number
): { chart: ChartData<'matrix'>; options: ChartOptions<'matrix'>; minCount: number; maxCount: number; outliers: number;
} {
    if (!data || data.length === 0) return { 
        chart: { datasets: [] }, options: {}, minCount: 0, maxCount: 0, outliers: 0
    };
    
    const xValues = data.map(d => (d[xKey] instanceof Date ? d[xKey].getTime() : d[xKey]));
    const yValues = data.map(d => d[yKey]);


    const actualMinX = Math.min(...xValues);
    const actualMaxX = Math.max(...xValues);
    const actualMinY = Math.min(...yValues);
    const actualMaxY = Math.max(...yValues);

    const minX = Math.floor(((minViewX ?? actualMinX)- offsetX) / bucketSizeX) * bucketSizeX + offsetX;
    const maxX = Math.ceil(((maxViewX ?? actualMaxX) - offsetX) / bucketSizeX) * bucketSizeX + offsetX;
    
    const minY = Math.floor(((minViewY ?? actualMinY) - offsetY) / bucketSizeY) * bucketSizeY + offsetY;
    const maxY = Math.ceil(((maxViewY ?? actualMaxY) - offsetY) / bucketSizeY) * bucketSizeY + offsetY;

    const binsX = Math.max(1, Math.round((maxX - minX) / bucketSizeX));
    const binsY = Math.max(1, Math.round((maxY - minY) / bucketSizeY));

    let numberOfOutliers = 0;
    const grid: Record<string, { x: number, y: number, v: number, ids: number[] }> = {};

    data.forEach(d => {
        const valX = d[xKey] instanceof Date ? d[xKey].getTime() : d[xKey];
        const valY = d[yKey];

        const unsafeBinX = Math.floor((valX - minX) / bucketSizeX);
        const unsafeBinY = Math.floor((valY - minY) / bucketSizeY);
        
        const safeBinX = Math.min(Math.max(unsafeBinX, 0), binsX - 1);
        const safeBinY = Math.min(Math.max(unsafeBinY, 0), binsY - 1);
        
        if (valX < minX || valX > maxX || valY < minY || valY > maxY) {
            numberOfOutliers += 1;
        }
        const key = `${safeBinX}-${safeBinY}`;

        if (!grid[key]) {
            // Store the exact CENTER of the bin so the matrix plugin centers the square
            grid[key] = { 
                x: minX + (safeBinX * bucketSizeX) + (bucketSizeX / 2), 
                y: minY + (safeBinY * bucketSizeY) + (bucketSizeY / 2),
                v: 0,
                ids: []
            };
        }
        grid[key].v++;
        if (grid[key].ids.length < 10) grid[key].ids.push(d[idKey]);
    });

    const matrixData = Object.values(grid);
    const actualMaxCount = Math.max(...matrixData.map(d => d.v));
    const maxCount = maxViewCount ?? actualMaxCount;
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

                    if (value > maxCount) return interpolateInferno(0);

                    const range = maxCount - minCount || 1;
                    const normalized = (maxCount - value) / range;

                    return interpolateInferno(normalized);
                },
            }]
        },
        options: {
            onClick: (event, elements, chart) => {
                if (elements.length > 0) {
                    const index = elements[0].index;
                    const datasetIndex = elements[0].datasetIndex;
                    const dataPoint = chart.data.datasets[datasetIndex].data[index] as any;
                    
                    if (dataPoint.ids && dataPoint.ids.length > 0) {
                        const idString = dataPoint.ids.join(', ');
                        navigator.clipboard.writeText(idString);
                        alert(`IDs copied to clipboard: ${idString}`);
                    }
                }
            },
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
                        label: (context: any) => {
                            const raw = context.raw;
                            const lines = [`Count: ${raw.v}`];

                            if (raw.ids && raw.ids.length > 0) {
                                raw.ids.forEach((id: any) => {
                                    lines.push(`${idKey}: ${id}`);
                                });
                            }

                            return lines;
                        }
                    }
                }
            }
        },
        minCount: minCount,
        maxCount: actualMaxCount,
        outliers: numberOfOutliers
    };
}