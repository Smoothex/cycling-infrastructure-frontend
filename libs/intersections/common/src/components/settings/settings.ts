import { Component, input, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { Checkbox } from 'primeng/checkbox';
import { InputNumber } from 'primeng/inputnumber';
import { Select } from 'primeng/select';

import { SettingGroup } from '@simra/intersections-common';

@Component({
    selector: 'settings',
    standalone: true,
    imports: [CommonModule, FormsModule, AccordionModule, ButtonModule, Checkbox, InputNumber, Select],
    templateUrl: './settings.html'
})
export class Settings {
    settings = input.required<SettingGroup[]>();
    isSettingsVisible = input.required<boolean>();
}