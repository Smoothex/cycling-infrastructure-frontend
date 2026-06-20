import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';

import { SettingGroup } from '../../lib/common/interfaces';

@Component({
    selector: 'intersection-settings',
    standalone: true,
    imports: [CommonModule, FormsModule, AccordionModule, ButtonModule, Checkbox, InputNumber, Select],
    templateUrl: './settings.html'
})
export class SettingsComponent {
    settings = input.required<SettingGroup[]>();
    isSettingsVisible = input.required<boolean>();
}