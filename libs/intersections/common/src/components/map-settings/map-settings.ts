import { CommonModule } from '@angular/common';
import { Component, input, model, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Button } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { Card } from 'primeng/card';
import { Panel } from 'primeng/panel';
import { Popover } from 'primeng/popover';
import { Select } from 'primeng/select';
import { ETrafficTimes, EWeekDays, EYear } from '@simra/common-models';
import { DateFilterPrecomputed, DATE_FILTER_DEFAULTS} from '@simra/intersections-common';


@Component({
	selector: 'map-settings',
	imports: [
		CommonModule,
		FormsModule,
		Button,
		Checkbox,
		Card,
		Panel,
		Popover,
		Select,
		DateFilterPrecomputed
	],
	templateUrl: './map-settings.html',
	styleUrl: './map-settings.scss',
	encapsulation: ViewEncapsulation.None
})
export class MapSettings {
	showTrafficSignals = model<boolean>(true);
	showIntersectionMetrics = model<boolean>(true);

	selectedRideId = model<number | null>(null);
	selectableRideIds = input<{ id: number; label: string }[]>([]);

    selectedYear = model<EYear>(DATE_FILTER_DEFAULTS.year);
    selectedWeekDays = model<EWeekDays>(DATE_FILTER_DEFAULTS.weekDays);
    selectedTrafficTime = model<ETrafficTimes>(DATE_FILTER_DEFAULTS.trafficTime);
}
