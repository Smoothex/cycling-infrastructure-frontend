
import { ChangeDetectionStrategy, Component, effect, inject, model, ViewEncapsulation } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { Store } from '@ngxs/store';
import { EDangerousColors, ETrafficTimes, EWeekDays, EYear } from '@simra/common-models';
import { UpdateFilterOptions } from '@simra/common-state';
import { first } from 'lodash';
import { Button } from 'primeng/button';
import { Card } from 'primeng/card';
import { Popover } from 'primeng/popover';
import { ColorBlockComponent } from '../../../atoms/color-block/component/color-block.component';
import { TRAFFIC_TIMES_TO_TRANSLATION } from '../../../translations/maps/traffic-times-to-translation';
import { WEEK_DAYS_TO_TRANSLATION } from '../../../translations/maps/week-days-to-translation';
import { YEAR_TO_TRANSLATION } from '../../../translations/maps/year-to-translation';
import { EnumSelectButtonComponent } from '../../enum-select-button/component/enum-select-button.component';
import { EnumSelectComponent } from '../../enum-select/component/enum-select.component';

/**
 * This component indicates the coloring of the map and allows to filter
 */
@Component({
	selector: 'm-dangerous-score-bar',
	imports: [
    ColorBlockComponent,
    FormsModule,
    Button,
    Card,
    Popover,
    TranslatePipe,
    EnumSelectComponent,
    EnumSelectButtonComponent
],
	templateUrl: './dangerous-score-bar.component.html',
	styleUrl: './dangerous-score-bar.component.scss',
	changeDetection: ChangeDetectionStrategy.OnPush,
	encapsulation: ViewEncapsulation.None,
	host: {
		class: 'm-dangerous-score-bar',
	},
})
export class DangerousScoreBarComponent {
	private readonly _store = inject(Store);

	protected readonly EDangerousColors = EDangerousColors;
	/**
	 * Indicates which traffic time is selected to filter on the map
	 *
	 * @protected
	 */
	protected readonly _selectedTrafficTime = model<ETrafficTimes>(ETrafficTimes.ALL_DAY);
	protected readonly _selectedYear = model<EYear>(EYear.ALL);
	/**
	 * Contains all selected weekdays
	 *
	 * @protected
	 */
	protected readonly _selectedWeekDays = model<EWeekDays[]>([EWeekDays.WEEK, EWeekDays.WEEKEND]);

	constructor() {
		effect(() => {
			const selectedWeekDays = this._selectedWeekDays();
			const weekDay =
				selectedWeekDays.length === 1 ? first(selectedWeekDays) : EWeekDays.ALL_WEEK;

			this._store.dispatch(
				new UpdateFilterOptions({
					trafficTime: this._selectedTrafficTime(),
					year: this._selectedYear(),
					weekDay,
				}),
			);
		});
	}

	protected readonly WEEK_DAYS_TO_TRANSLATION = WEEK_DAYS_TO_TRANSLATION;
	protected readonly EWeekDays = EWeekDays;
	protected readonly ETrafficTimes = ETrafficTimes;
	protected readonly TRAFFIC_TIMES_TO_TRANSLATION = TRAFFIC_TIMES_TO_TRANSLATION;
	protected readonly EYear = EYear;
	protected readonly YEAR_TO_TRANSLATION = YEAR_TO_TRANSLATION;
}
