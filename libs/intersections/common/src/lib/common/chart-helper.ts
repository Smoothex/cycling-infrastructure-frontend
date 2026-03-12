import { TranslatePipe } from '@ngx-translate/core';
import { Chart, registerables, ChartData, ChartOptions } from 'chart.js';
import { BoxPlotController, BoxAndWiskers } from '@sgratzl/chartjs-chart-boxplot';
import 'chartjs-adapter-date-fns';

Chart.register(...registerables, BoxPlotController, BoxAndWiskers);

export function createHistogram(
    data: number[], 
    bucketSize: number, 
    offset: number,
    xLabel: string, 
    yLabel: string
) : { chart: ChartData<'bar'>; options: ChartOptions<'bar'>} {

    const min = data.length > 0 ? Math.floor((Math.min(...data) - offset) / bucketSize) * bucketSize + offset: 0;
    const max = data.length > 0 ? Math.ceil((Math.max(...data) - offset) / bucketSize) * bucketSize + offset: 0;

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
        const start = Math.max(0, index - Math.floor(windowSize / 2));
        const end = Math.min(sortedData.length, index + Math.floor(windowSize / 2));
        const window = sortedData.slice(start, end).map(d => d[yKey]).sort((a, b) => a - b);
        const median = window[Math.floor(window.length / 2)];
        const average = window.reduce((a, b) => a + b) / window.length;

        return {
            median : { x: sortedData[index][xKey], y: median },
            average: { x: sortedData[index][xKey], y: average }
        };
    });
}

export function createMovingMedianChart(
    data: any[], 
    xKey: string, 
    yKey: string, 
    windowSize: number, 
    yLabel: string
){
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
                    label: `Moving Median (Window: ${windowSize})`,
                    type: 'line',
                    data: medianLine,
                    borderColor: '#42A5F5',
                    borderWidth: 3,
                    pointRadius: 0, // Hide points on the median line
                },
                {
                    label: `Moving Average (Window: ${windowSize})`,
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
){
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
                    label: `Moving Median (Window: ${windowSize})`,
                    type: 'line',
                    data: medianLine,
                    borderColor: '#42A5F5',
                    borderWidth: 3,
                    pointRadius: 0, // Hide points on the median line
                },
                {
                    label: `Moving Average (Window: ${windowSize})`,
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

export function createBoxPlot<T>(
    data: T[], 
    categoryKey: keyof T, 
    valueKey: keyof T,
    xLabel: string, 
    xLabelTranslation: Record<string, string>,
    yLabel: string
): { chart: ChartData<'boxplot'>; options: ChartOptions<'boxplot'>} {
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