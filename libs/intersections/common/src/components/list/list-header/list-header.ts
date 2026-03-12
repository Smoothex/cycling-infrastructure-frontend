import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TableModule } from 'primeng/table';
import { Tooltip } from 'primeng/tooltip';
import { IntersectionRow, ListColumn } from '@simra/intersections-common';
import { TranslatePipe } from '@ngx-translate/core';


@Component({
	selector: '[intersection-list-header]',
	standalone: true,
	imports: [CommonModule, TableModule, Tooltip, TranslatePipe],
	templateUrl: './list-header.html',
})
export class IntersectionListHeader<T extends IntersectionRow> {
    public columns = input.required<ListColumn<T>[]>();
}
