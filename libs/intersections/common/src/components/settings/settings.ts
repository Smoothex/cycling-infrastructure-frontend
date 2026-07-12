import { Component, input } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputNumber } from 'primeng/inputnumber';
import { Listbox } from 'primeng/listbox';

import { SettingGroup } from '../../lib/common/interfaces';


@Component({
    selector: 'intersection-settings',
    standalone: true,
    imports: [FormsModule, AccordionModule, ButtonModule, Checkbox, InputNumber, Listbox],
    templateUrl: './settings.html'
})
export class SettingsComponent {
    settings = input.required<SettingGroup[]>();
    isSettingsVisible = input.required<boolean>();
}