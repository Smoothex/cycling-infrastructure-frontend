import { ChangeDetectionStrategy, Component, EventEmitter, HostBinding, input, model, Output, ViewEncapsulation } from '@angular/core';

import { FormsModule } from '@angular/forms';
import { TranslateModule } from '@ngx-translate/core';
import { AutoCompleteCompleteEvent, AutoCompleteModule, AutoCompleteSelectEvent } from 'primeng/autocomplete';
import { FloatLabel } from 'primeng/floatlabel';
import { debounceTime, firstValueFrom, Observable, of, switchMap } from 'rxjs';

@Component({
	selector: 'm-autocomplete',
	imports: [
    TranslateModule,
    FormsModule,
    AutoCompleteModule,
    FloatLabel
],
	templateUrl: './autocomplete.component.html',
	styleUrl: './autocomplete.component.scss',
	host: {
		class: 'm-autocomplete-component',
	},
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AutocompleteComponent {
	public readonly field = input.required<string>();
	public readonly size = input<'small' | 'large'>('small');
	public readonly placeholder = input<string>();
	public readonly showDropdown = input<boolean>(false);
	public readonly selected = model();
	public readonly fetchFunction = input.required<(query: string) => Observable<string[]>>();
	protected readonly filteredOptions = model<string[]>([]);
	@Output()
	public selectionChange = new EventEmitter<Record<string, string>>();

	isFloating = false;

	/**
	 * Emits the selected values
	 */
	protected onSelectionChange(values: AutoCompleteSelectEvent | null) {
		const field = this.field();
		if (!field) return;

		this.selectionChange.emit({ [field]: values?.value || '' });
	}

	protected async onComplete(event: AutoCompleteCompleteEvent) {
		const query = event.query.trim();
		const fetchFunction = this.fetchFunction();

		if (!fetchFunction) {
			this.filteredOptions.set([]);
			return;
		}

		if (!query) {
			this.onSelectionChange(null);
		}

		const options = await firstValueFrom(
			of(query).pipe(
				debounceTime(300),
				switchMap(fetchFunction)
			)
		);
		this.filteredOptions.set(options);
	}

	@HostBinding('class.placeholder-label')
	get applyMinWidth() {
		return !this.isFloating;
	}
}
