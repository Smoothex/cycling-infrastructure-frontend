import { Component, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableFilterEvent, TableModule } from 'primeng/table';
import { IntersectionRow, ListColumn } from '../../../lib/common/interfaces';
import {
	EnumSelectComponent,
	AutocompleteComponent,
	NumberFilterComponent
} from '@simra/common-components';

@Component({
	// eslint-disable-next-line @angular-eslint/component-selector
	selector: '[intersection-list-header-filter]',
	imports: [CommonModule, FormsModule, TableModule, AutocompleteComponent, NumberFilterComponent, EnumSelectComponent],
	templateUrl: './list-header-filter.html',
})
export class IntersectionListHeaderFilterComponent<T extends IntersectionRow> {
    public columns = input.required<ListColumn<T>[]>();
	public filterChange = output<TableFilterEvent>();
}
