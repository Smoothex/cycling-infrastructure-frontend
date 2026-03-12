import { ChangeDetectionStrategy, Component, effect, inject, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { NavigationEnd, Router, RouterLink } from '@angular/router';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import { MenuItem } from 'primeng/api';
import { Badge } from 'primeng/badge';
import { Breadcrumb } from 'primeng/breadcrumb';
import { Menubar } from 'primeng/menubar';
import { Ripple } from 'primeng/ripple';
import { SelectButton, SelectButtonChangeEvent } from 'primeng/selectbutton';
import { Tooltip } from 'primeng/tooltip';
import { environment } from '../../../../environments/environment';
import { PrefetchService } from '../../../services/prefetch.service';

@Component({
	selector: 'menu-bar',
	imports: [
		CommonModule,
		Menubar,
		Badge,
		Ripple,
		TranslatePipe,
		RouterLink,
		Breadcrumb,
		FormsModule,
		ReactiveFormsModule,
		SelectButton,
		Tooltip,
	],
	templateUrl: './menu-bar.component.html',
	styleUrl: './menu-bar.component.scss',
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'menu-bar',
	},
})
export class MenuBarComponent {
	private readonly _translateService = inject(TranslateService);
	private readonly _prefetchService = inject(PrefetchService);
	private readonly _router = inject(Router);

	private readonly _prodItems: MenuItem[] = [
		{
			label: 'APP.COMPONENTS.MENU_BAR.ITEMS.HOME',
			icon: 'ph-bold ph-house-simple',
			routerLink: '/',
		},
		{
			label: 'APP.COMPONENTS.MENU_BAR.ITEMS.REGIONS',
			icon: 'ph-bold ph-map-pin-simple-area',
			items: [
				{
					label: 'APP.COMPONENTS.MENU_BAR.ITEMS.ADMINISTRATIVE_REGIONS',
					icon: 'ph-bold ph-city',
					routerLink: '/administrative-districts',
				},
				{
					label: 'APP.COMPONENTS.MENU_BAR.ITEMS.SIMRA_REGIONS',
					icon: 'ph-bold ph-globe-stand',
					routerLink: '/simra-regions',
				},
			],
		},
		{
			label: 'APP.COMPONENTS.MENU_BAR.ITEMS.STREETS',
			icon: 'ph-bold ph-road-horizon',
			items: [
				{
					label: 'APP.COMPONENTS.MENU_BAR.ITEMS.LIST',
					icon: 'ph-bold ph-table',
					routerLink: '/streets',
				},
				{
					label: 'APP.COMPONENTS.MENU_BAR.ITEMS.MAP',
					icon: 'ph-bold ph-map-trifold',
					routerLink: '/streets/map'
				},
			],
		},
		{
			label: 'APP.COMPONENTS.MENU_BAR.ITEMS.INCIDENTS',
			icon: 'ph-bold ph-warning-diamond',
			routerLink: '/incidents',
		},
		{
			label: 'APP.COMPONENTS.MENU_BAR.ITEMS.INTERSECTIONS',
			icon: 'ph-bold ph-traffic-signal',
			items: [
				{
					label: 'APP.COMPONENTS.MENU_BAR.ITEMS.MAP',
					icon: 'ph-bold ph-map-pin-area',
					routerLink: '/intersections/map'
				},
				{
					label: 'APP.COMPONENTS.MENU_BAR.ITEMS.STREETS',
					icon: 'ph-bold ph-road-horizon',
					routerLink: '/intersections',
				},
				{
					label: 'APP.COMPONENTS.MENU_BAR.ITEMS.ADMINISTRATIVE_REGIONS',
					icon: 'ph-bold ph-city',
					routerLink: '/intersections/regions'
				}
			],
		},
	];
	private readonly _devItems: MenuItem[] = [
		{
			label: 'APP.COMPONENTS.MENU_BAR.ITEMS.RIDES',
			icon: 'ph-bold ph-person-simple-bike',
			routerLink: '/rides',
		},
	];
	protected readonly _items = [
		...(environment.production ? [] : this._devItems),
		...this._prodItems,
	];
	protected readonly _languages: MenuItem[] = [
		{
			id: 'en',
			icon: 'fi fi-gb',
			label: 'APP.COMPONENTS.MENU_BAR.SETTINGS.LANGUAGE.EN',
		},
		{
			id: 'de',
			icon: 'fi fi-de',
			label: 'APP.COMPONENTS.MENU_BAR.SETTINGS.LANGUAGE.DE',
		},
	];
	protected readonly _selectedLanguage = signal<MenuItem>(
		this._languages.find((ele) => ele.id === this._translateService.currentLang) || this._languages[0],
	);

	private readonly _routerEvents = toSignal(this._router.events);
	protected _breadcrumbItems$ = signal<MenuItem[]>([]);

	protected readonly _home: MenuItem = {
		routerLink: '/',
		icon: 'ph-bold ph-house-simple',
	};

	constructor() {
		effect(() => {
			const event = this._routerEvents();
			if (!(event instanceof NavigationEnd)) {
				return;
			}

			const breadcrumbs: MenuItem[] = [];
			let accumulatedUrl = '';

			const cleanedUrl = event.url.split('?')[0].split('#')[0];
			const pathSegments = cleanedUrl.split('/').filter((segment) => segment !== '');

			for (const segment of pathSegments) {
				accumulatedUrl += `/${segment}`;
				const capitalizedSegment = decodeURIComponent(
					this.capitalizeAfterHyphen(segment[0].toUpperCase() + segment.slice(1)),
				);
				breadcrumbs.push({ label: capitalizedSegment, routerLink: accumulatedUrl });
			}

			this._breadcrumbItems$.set(breadcrumbs);
		});
	}

	private capitalizeAfterHyphen(input: string): string {
		return input
			.split('-')
			.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
			.join('-');
	}

	protected selectLanguage(language: SelectButtonChangeEvent): void {
		this._translateService.use(language.value?.id);
	}
}
