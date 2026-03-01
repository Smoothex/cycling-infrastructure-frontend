import { Component, model, input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core'; // Assuming usage based on pipe

import { FloatLabelModule } from 'primeng/floatlabel';
import { DatePickerModule } from 'primeng/datepicker';
import { Card } from 'primeng/card';

import { 
    EnumSelectButtonComponent,
    EnumSelectComponent,
    TRAFFIC_TIMES_TO_TRANSLATION,
	WEEK_DAYS_TO_TRANSLATION,
	YEAR_TO_TRANSLATION,
    CARD_MODE_TO_TRANSLATION_MAP
} from '@simra/common-components';
import { EYear, ETrafficTimes, EWeekDays } from '@simra/common-models';


@Component({
    selector: 'date-filter-precomputed',
    standalone: true,
    templateUrl: './date-filter-precomputed.html',
    imports: [
        CommonModule,
        FormsModule,
        TranslatePipe,
        EnumSelectButtonComponent,
        EnumSelectComponent,
        FloatLabelModule,
        DatePickerModule,
    ],
    encapsulation: ViewEncapsulation.None,
})
export class DateFilterPrecomputed {

    selectedYear = model.required<EYear>();
    selectedWeekDays = model.required<EWeekDays>();
    selectedTrafficTime = model.required<ETrafficTimes>();

    // references for template
    protected readonly EYear = EYear;
    protected readonly ETrafficTimes = ETrafficTimes;
    protected readonly EWeekDays = EWeekDays;
    protected readonly YEAR_TO_TRANSLATION = YEAR_TO_TRANSLATION; 
    protected readonly TRAFFIC_TIMES_TO_TRANSLATION = TRAFFIC_TIMES_TO_TRANSLATION;
    protected readonly WEEK_DAYS_TO_TRANSLATION = WEEK_DAYS_TO_TRANSLATION;
}