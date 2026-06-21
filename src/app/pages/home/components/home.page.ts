import { NgOptimizedImage } from '@angular/common';
import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';

import { ChipModule } from 'primeng/chip';
import { Tab, TabList, TabPanel, TabPanels, Tabs } from 'primeng/tabs';
import { CITY_POSITION_LINKS } from '../models/const';

@Component({
	selector: 'app-home.page',
	imports: [
    Tabs,
    TabList,
    Tab,
    TabPanels,
    TabPanel,
    TranslatePipe,
    ChipModule,
    NgOptimizedImage,
    RouterLink
],
	templateUrl: './home.page.html',
	styleUrl: './home.page.scss',
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 'app-home-page',
	},
})
export class HomePage {

	protected readonly CITY_POSITION_LINKS = CITY_POSITION_LINKS;
}
