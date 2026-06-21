import { computed, Directive, effect, inject, Input, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslateService } from '@ngx-translate/core';
import { UIChart } from 'primeng/chart';
import { firstValueFrom } from 'rxjs';


@Directive({
	selector: 'p-chart',
})
export class ChartDirective {
	private readonly _translateService = inject(TranslateService);
	private readonly _elementRef = inject(UIChart);

	@Input() plugins: any[] = [];
	@Input() data: any;
	@Input() type: string;

	private readonly _primaryTextColor = getComputedStyle(document.documentElement).getPropertyValue('--p-text-color')
	private readonly _backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--p-surface-100')
	private readonly langSignal = toSignal(this._translateService.onLangChange);

	private readonly _translation$ = resource({
		params: () => this.langSignal() ?? this._translateService.currentLang,
		loader: () => {
			return firstValueFrom(this._translateService.get('COMPONENTS.GENERAL.CHART.NO_DATA'));
		}
	});

	constructor() {
		effect(() => {
			const noDataPlugin = this.noDataPlugin();
			if (!noDataPlugin) {
				return;
			}

			const chartPlugins = this._elementRef.plugins || [];
			if (!chartPlugins.find(plugin => plugin.id === 'noData')) {
				this._elementRef.plugins = [...chartPlugins, noDataPlugin];
			} else {
				this._elementRef.plugins = chartPlugins.map((plugin: any) => {
					if (plugin.id === 'noData') {
						return noDataPlugin;
					}
					return plugin;
				});
			}

			this._elementRef.reinit();
		});
	}

	private noDataPlugin = computed(() => {
		const translation = this._translation$.value();

		return {
			id: 'noData',
			afterDatasetsDraw: (chart: any) => {
				if (chart.data.datasets.every((dataset: any) =>
					dataset.data.every((value: number) => value === 0)
				)) {
					const { ctx, chartArea: { top, left, width, height } } = chart;
					const centerX = left + width / 2;
					let centerY = top + height / 2;
					const noDataText = translation;

					if (this.type === 'pie') {
						const radius = Math.min(width, height) * 0.35;
						centerY = centerY * 1.1;

						ctx.save();
						// Draw grey pie background
						ctx.beginPath();
						ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
						ctx.fillStyle = this._backgroundColor;
						ctx.fill();
						ctx.closePath();

						ctx.textAlign = 'center';
						ctx.textBaseline = 'middle';
						ctx.fillStyle = this._primaryTextColor;
						ctx.fillText(noDataText, centerX, centerY);
					}
					if (this.type === 'bar' || this.type === 'line') {
						ctx.save();

						ctx.fillStyle = this._backgroundColor;
						ctx.fillRect(left, top, width, height);

						ctx.textAlign = 'center';
						ctx.textBaseline = 'middle';
						ctx.fillStyle = this._primaryTextColor;
						ctx.fillText(noDataText, centerX, centerY);
					}

					ctx.restore();
				}
			}
		}
	});
}
