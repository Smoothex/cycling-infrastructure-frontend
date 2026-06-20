import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { Tooltip } from 'primeng/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { IntersectionRow, ListColumn } from '../../../lib/common/interfaces';


@Component({
	// eslint-disable-next-line @angular-eslint/component-selector
	selector: '[intersection-list-header]',
	standalone: true,
	imports: [CommonModule, TableModule, Tooltip, TranslatePipe],
	templateUrl: './list-header.html',
})
export class IntersectionListHeaderComponent<T extends IntersectionRow> {
    public columns = input.required<ListColumn<T>[]>();
}
