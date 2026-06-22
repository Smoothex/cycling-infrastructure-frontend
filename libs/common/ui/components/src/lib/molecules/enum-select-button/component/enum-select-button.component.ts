import { Component, computed, input, model } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { TTranslationMap } from '../../../translations/interfaces/translation-map.type';
import { filter } from 'lodash';
import { SelectButton } from 'primeng/selectbutton';
import { Tooltip } from 'primeng/tooltip';
import { $enum } from 'ts-enum-util';

@Component({
	selector: 'm-enum-select-button',
	imports: [SelectButton, FormsModule, Tooltip, TranslatePipe],
	templateUrl: './enum-select-button.component.html',
	styleUrl: './enum-select-button.component.scss',
})
export class EnumSelectButtonComponent {
	public readonly size = input<'small' | 'large'>('small');
	public readonly multiple = input<boolean>(false);
	public readonly translationMap = input.required<TTranslationMap<string>>();
	public readonly filterFunction = input<(option: string) => boolean>((option: string) => !option.startsWith('ALL_'));
	public readonly selected = model();
	public readonly optionEnum = input.required({
		transform: (enumType: object) => {
			return $enum(enumType).getValues() as string[];
		},
	});

	/** ✅ Compute filtered options after receiving inputs */
	public readonly filteredOption = computed(() => {
		const filterFn = this.filterFunction();
		const options = this.optionEnum();
		if (!filterFn) {
			return options;
		}

		return filter(options, (option) => filterFn(option));
	});

}
