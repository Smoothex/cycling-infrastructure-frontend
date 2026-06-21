
import {
	Component,
	computed, effect,
	inject,
	ViewEncapsulation,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { Store } from '@ngxs/store';
import { FallbackValueDirective } from '@simra/common-components';
import { StreetDetailState } from '@simra/streets-domain';
import { get, times } from 'lodash';
import { ButtonDirective } from 'primeng/button';
import { Card } from 'primeng/card';
import { Skeleton } from 'primeng/skeleton';
import { CYCLEWAY_LANES_TO_TRANSLATION } from '../../../translations/maps/cycleway-lanes-to-translation.map';
import { HIGHWAY_TYPES_TO_TRANSLATION } from '../../../translations/maps/highway-types-to-translation';
import { PARKING_TO_TRANSLATION } from '../../../translations/maps/street-parking-to-translation.map';
import { MapCarouselComponent } from '../../map-carousel/component/map-carousel.component';
import { ITagCard } from '../models/tag-card.interface';

@Component({
	selector: 'm-street-information-card',
	imports: [
    Card,
    TranslatePipe,
    Skeleton,
    MapCarouselComponent,
    ButtonDirective,
    FallbackValueDirective,
    RouterLink
],
	templateUrl: './street-information-card.component.html',
	styleUrl: './street-information-card.component.scss',
	host: {
		class: 'm-street-information-card',
	},
	encapsulation: ViewEncapsulation.None,
})
export class StreetInformationCardComponent {
	private readonly _store = inject(Store);
	private readonly _activatedRoute = inject(ActivatedRoute);

	protected readonly _street$ = this._store.selectSignal(StreetDetailState.getStreet);
	private readonly _queryParams = toSignal(this._activatedRoute.queryParams);
	protected readonly _googleLink$ = computed(() => {
		const { lat, lng } = this._queryParams();
		if (!lat || !lng) {
			return;
		}
		return `https://www.google.com/maps?q=&layer=c&cbll=${lat},${lng}`;
	});

	constructor() {
		effect(() => {
			console.log(this._street$())
		});
	}


	items: ITagCard[] = [
		{
			title: 'CYCLEWAY',
			translationMap: CYCLEWAY_LANES_TO_TRANSLATION,
			children: [
				{
					title: 'LEFT',
					children: [
						{
							title: 'TYPE',
							value: 'cyclewayLeft.type',
							link: 'https://wiki.openstreetmap.org/wiki/Key:cycleway:lane',
						},
						{
							title: 'WIDTH',
							value: 'cyclewayLeft.width',
						},
					],
				},
				{
					title: 'RIGHT',
					children: [
						{
							title: 'TYPE',
							value: 'cyclewayRight.type',
							link: 'https://wiki.openstreetmap.org/wiki/Key:cycleway:lane',
						},
						{
							title: 'WIDTH',
							value: 'cyclewayRight.width',
						},
					],
				},
			],
		},
		{
			title: 'PARKING',
			translationMap: PARKING_TO_TRANSLATION,
			children: [
				{
					title: 'LEFT',
					children: [
						{
							title: 'TYPE',
							value: 'parkingLeft.type',
							link: 'https://wiki.openstreetmap.org/wiki/Street_parking',
						},
					],
				},
				{
					title: 'RIGHT',
					children: [
						{
							title: 'TYPE',
							value: 'parkingRight.type',
							link: 'https://wiki.openstreetmap.org/wiki/Street_parking',
						},
					],
				},
			],
		},
	];

	protected readonly get = get;
	protected readonly times = times;
	protected readonly HIGHWAY_TYPES_TO_TRANSLATION = HIGHWAY_TYPES_TO_TRANSLATION;
}
