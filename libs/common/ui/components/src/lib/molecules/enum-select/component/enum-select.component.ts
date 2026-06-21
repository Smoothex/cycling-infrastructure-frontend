import { ChangeDetectionStrategy, Component, EventEmitter, input, model, Output } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslatePipe } from '@ngx-translate/core';
import { Select } from 'primeng/select';
import { Tooltip } from 'primeng/tooltip';
import { TTranslationMap } from '../../../translations/interfaces/translation-map.type';
import { PrimeTemplate } from 'primeng/api';
import { $enum } from 'ts-enum-util';

@Component({
	selector: 'm-enum-select-component',
	imports: [
    TranslateModule,
    PrimeTemplate,
    TranslatePipe,
    FormsModule,
    Select,
    Tooltip
],
	templateUrl: './enum-select.component.html',
	styleUrl: './enum-select.component.scss',
	host: {
		class: 'm-enum-multi-select-component',
	},
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnumSelectComponent {
	public readonly field = input<string>();
	public readonly size = input<'small' | 'large'>('small');
	public readonly translationMap = input.required<TTranslationMap<string>>();
	public readonly optionEnum = input.required({
		transform: (enumType: object) => {
			return $enum(enumType).getValues() as [];
		},
	});
	public readonly selected = model();
	public readonly filter = input<boolean>(false);
	@Output()
	public selectionChange = new EventEmitter<Record<string, string[]>>();

	/**
	 * Emits the selected values
	 */
	protected onSelectionChange(values: string[]) {
		const field = this.field();
		if (!field) {
			return ;
		}
		this.selectionChange.emit({ [this.field()]: values });
	}
}
