import { ChangeDetectionStrategy, Component, EventEmitter, inject, input, model, Output } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { TranslateModule, TranslatePipe, TranslateService } from '@ngx-translate/core';
import { TTranslationMap } from '../../../translations/interfaces/translation-map.type';
import { PrimeTemplate } from 'primeng/api';
import { MultiSelect } from 'primeng/multiselect';
import { $enum } from 'ts-enum-util';

@Component({
	selector: 'm-enum-multi-select-component',
	imports: [
    TranslateModule,
    MultiSelect,
    PrimeTemplate,
    TranslatePipe,
    FormsModule
],
	templateUrl: './enum-multi-select.component.html',
	styleUrl: './enum-multi-select.component.scss',
	host: {
		class: 'm-enum-multi-select-component',
	},
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EnumMultiSelectComponent {
	private readonly _translationService = inject(TranslateService);

	field = input.required<string>();
	translationMap = input.required<TTranslationMap<string>>();
	optionEnum = input.required({
		transform: (enumType: object) => {
			return $enum(enumType).getValues() as [];
		},
	});
	selected = model<string[] | number[]>([]);
	filter = input<boolean>(false);
	maxSelectedDisplay = input<number>(1);
	@Output() selectionChange = new EventEmitter<Record<string, string[]>>();

	/**
	 * Gets the selected translations
	 */
	getSelectedTranslations(
		selectedKeys: (keyof TTranslationMap)[] | string[],
	): string {
		if (!selectedKeys) {
			return;
		}

		if (selectedKeys.length >= this.maxSelectedDisplay() + 1) {
			return `${selectedKeys.length} ${this._translationService.instant('COMPONENTS.GENERAL.TABLE.ITEMS.SELECTED')}`;
		}

		const translatedKeys = selectedKeys.map((key) => this.translationMap()[key]?.label || key);
		return translatedKeys.map((label) => this._translationService.instant(label)).join(', ');
	}

	/**
	 * Emits the selected values
	 */
	onSelectionChange(values: string[]) {
		this.selectionChange.emit({ [this.field()]: values });
	}
}
