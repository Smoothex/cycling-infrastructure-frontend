import { Component, ElementRef, input, signal, computed, viewChild, model, inject, effect } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { ChartModule } from 'primeng/chart';
import { merge } from 'lodash';

import {
    SettingGroup,
    ChartFilter,
    recordToOptions,
    TimeCategoryLabels,
    TimeCategory,
    ChartComplete
} from '../../lib/common/interfaces';
import { SettingsDrawerComponent } from '../settings/settings-drawer';
import {
	TRAFFIC_TIMES_TO_TRANSLATION,
	WEEK_DAYS_TO_TRANSLATION, 
	YEAR_TO_TRANSLATION
} from '@simra/common-components';
import { FullscreenDirective } from '@simra/common-components';

import html2canvas from 'html2canvas';
import { TranslateService } from '@ngx-translate/core';
import { ChartOptions } from 'chart.js';

const TimeCatergoryLabelTranslations: Record<TimeCategory, any> = {
    trafficTime: TRAFFIC_TIMES_TO_TRANSLATION,
    weekDay: WEEK_DAYS_TO_TRANSLATION,
    year: YEAR_TO_TRANSLATION,
}


@Component({
    selector: 'intersection-chart-wrapper',
    standalone: true,
    imports: [FormsModule, ButtonModule, ChartModule, SettingsDrawerComponent, FullscreenDirective],
    templateUrl: './chart-wrapper.html',
    styleUrl: './chart-wrapper.scss'
})
export class ChartWrapperComponent<T> {
    chart = input.required<ChartComplete>();
    settings = input.required<SettingGroup[]>();
    chartFilter = input.required<ChartFilter<T>>();
    downloadFileName = input.required<string>();

    sidebarVisible = signal<boolean>(false);
    screenshotMode = signal<boolean>(false);
    isExporting = signal<boolean>(false); 

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

    fs = viewChild(FullscreenDirective);
    protected scaledChartOptions = computed(() => {
        const baseOptions = this.chart().options;
        const isFullscreen = this.fs()?.fullscreenMode();
        
        if (!this.isExporting() && !isFullscreen) {
            return baseOptions;
        }

        const fontSize = 42; 
        const exportOverrides: ChartOptions = {
            maintainAspectRatio : false,
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

    isLargeMode = model.required<boolean>();

    constructor() {
        effect(() => {
            this.isLargeMode.set(this.fs()?.fullscreenMode() || this.isExporting());
        });
    }

    
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

    private translate = inject(TranslateService);
}