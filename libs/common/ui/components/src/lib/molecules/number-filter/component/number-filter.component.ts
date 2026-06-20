import { ChangeDetectionStrategy, Component, EventEmitter, input, model, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslatePipe } from '@ngx-translate/core';
import { TableModule } from 'primeng/table';
import { InputNumber } from 'primeng/inputnumber';

@Component({
	selector: 'm-number-filter',
	imports: [CommonModule, TranslatePipe, FormsModule, TableModule, InputNumber],
	templateUrl: './number-filter.component.html',
	styleUrl: './number-filter.component.scss',
	host: {
		class: 'm-number-filter',
	},
	changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NumberFilterComponent {
	@Output() filterChange = new EventEmitter<Record<string, number>>();
	field = input.required<string>();
	step = input<number>(1);
	min = input<number>(0);

	
	defaultValue = model<number>(0);

	defaultEventName = input<boolean>(false);

	onFilterChange() {
		const value = this.defaultValue();
		if (this.defaultEventName()) {
			this.filterChange.emit({ [this.field()]: value });
		} else {
			const minFieldName = 'min' + this.field().charAt(0).toUpperCase() + this.field().slice(1);
			this.filterChange.emit({ [minFieldName]: value });
		}
	}
}
