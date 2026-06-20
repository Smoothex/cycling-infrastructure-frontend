import { Component, model, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { FloatLabelModule } from 'primeng/floatlabel';
import { DatePickerModule } from 'primeng/datepicker';
import { Card } from 'primeng/card';
import { 
    EnumSelectComponent,
    TRAFFIC_TIMES_TO_TRANSLATION,
	WEEK_DAYS_TO_TRANSLATION,
	YEAR_TO_TRANSLATION
} from '@simra/common-components';
import { EYear, ETrafficTimes, EWeekDays } from '@simra/common-models';

@Component({
    selector: 'intersection-date-filter-precomputed',
    standalone: true,
    templateUrl: './date-filter-precomputed.html',
    styleUrl: './date-filter-precomputed.scss',
    imports: [
        CommonModule,
        FormsModule,
        EnumSelectComponent,
        FloatLabelModule,
        DatePickerModule,
        Card
    ],
    encapsulation: ViewEncapsulation.None,
})
export class DateFilterPrecomputedComponent {

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