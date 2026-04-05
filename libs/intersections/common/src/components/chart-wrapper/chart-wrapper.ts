import { Component, ElementRef, input, signal, computed, viewChild, model } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { PopoverModule } from 'primeng/popover';
import { merge } from 'lodash';

import { Settings, SettingGroup, ChartFilter, recordToOptions, TimeCategoryLabels, TimeCategory, ChartComplete } from '@simra/intersections-common';
import {
	TRAFFIC_TIMES_TO_TRANSLATION,
	WEEK_DAYS_TO_TRANSLATION, 
	YEAR_TO_TRANSLATION
} from '@simra/common-components';

import html2canvas from 'html2canvas';
import { TranslateService } from '@ngx-translate/core';
import { ChartOptions } from 'chart.js';

const TimeCatergoryLabelTranslations: Record<TimeCategory, any> = {
    trafficTime: TRAFFIC_TIMES_TO_TRANSLATION,
    weekDay: WEEK_DAYS_TO_TRANSLATION,
    year: YEAR_TO_TRANSLATION,
}


@Component({
    selector: 'chart-wrapper',
    standalone: true,
    imports: [CommonModule, FormsModule, ButtonModule, ChartModule, PopoverModule, Settings],
    templateUrl: './chart-wrapper.html'
})
export class ChartWrapper<T> {
    chart = input.required<ChartComplete>();
    settings = input.required<SettingGroup[]>();
    chartFilter = input.required<ChartFilter<T>>();
    downloadFileName = input.required<string>();

    downloadFileNameWithFilter = computed<string>(() => {
        const baseName = this.downloadFileName();

        const filterNameMin = this.chartFilter().min() ? `-min-${this.chartFilter().min()}` : "";
        const filterNameMax = this.chartFilter().max() ? `-max-${this.chartFilter().max()}` : "";
        const filterName = (filterNameMin || filterNameMax) ? `-filter-${String(this.chartFilter().onProperty())}${filterNameMin}${filterNameMax}` : "";
        
        return `${baseName}${filterName}`;
    })

    settingsWithFilter = computed<SettingGroup[]>(() => {
        const settings = this.settings();
        const newSettings = [...settings];
        newSettings.push({
            group: 'Filter', items: [
                { label: 'Select Filter Property', props: { type: "select", value: this.chartFilter().onProperty, options: this.chartFilter().selectableProperties }},
                { label: 'Minimum', props: { type: "number", value: this.chartFilter().min }},
                { label: 'Maximum', props: { type: "number", value: this.chartFilter().max }}
            ]
        })
        return newSettings;
    });

    settingsWithTimeCategory = computed<SettingGroup[]>(() => {
        const settings = this.settingsWithFilter();
        const timeCategory = this.chartFilter().timeCategory;
        const timeValue = this.chartFilter().timeCategoryValue;
        const timeCompare = this.chartFilter().timeCategoryCompare;
        if (!settings || !timeCategory || !timeValue || !timeCompare) return settings;

        const translation = TimeCatergoryLabelTranslations[timeCategory()] as any;
        const labelMap: Record<string, string> = {};
        for (const [key, value] of Object.entries(translation)) {
            labelMap[key] = this.translate.instant((value as any).label);
        }

        const newSettings = [...settings];
        newSettings.push({
            group: 'Time', items: [
                { label: 'Select Category', props: { type: "select", value: timeCategory, options: recordToOptions(TimeCategoryLabels) }},
                { label: 'Select Value', props: { type: "select", value: timeValue, options: recordToOptions(labelMap) }},
                { label: 'Select Compare', props: { type: "select", value: timeCompare, options: recordToOptions(labelMap) }},
            ]
        })
        return newSettings;
    })

    isSettingsVisible = signal(false);
    setSettingVisibility(visible: boolean) {
        this.isSettingsVisible.set(visible);
    }

    protected scaledChartOptions = computed(() => {
        const baseOptions = this.chart().options;
        
        if (!this.isExporting()) {
            return baseOptions;
        }

        const fontSize = 42; 
        const exportOverrides: ChartOptions = {
            plugins: {
                legend: {
                    labels: { font: { size: fontSize } }
                }
            },
            scales: {
                x: {
                    title: { font: { size: fontSize + 4 } },
                    ticks: { font: { size: fontSize } }
                },
                y: {
                    title: { font: { size: fontSize + 4 } },
                    ticks: { font: { size: fontSize } }
                }
            }
        };
        return merge({}, baseOptions, exportOverrides);
    });

    public isExporting = model.required<boolean>(); 
    private readonly screenshotContainer = viewChild<ElementRef<HTMLDivElement>>('screenshotContainer');
    protected async downloadAsImage() {
        this.isExporting.set(true);
        const element = this.screenshotContainer()?.nativeElement;
        if (!element) return;

        await new Promise(resolve => setTimeout(resolve, 1000));

        const canvas = await html2canvas(element, {
            backgroundColor: '#ffffff',
            logging: false,
            scale: 1,
        });

        const dataUrl = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `${this.downloadFileNameWithFilter()}.png`;
        link.href = dataUrl;
        link.click();
        this.isExporting.set(false);
    }

    constructor(private translate: TranslateService) { }
}