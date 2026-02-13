import { Component, effect, input, Input, signal, inject, computed, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router, ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';

import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';
import { BaseRow, ListColumn } from '@simra/intersections-common';
import { TranslatePipe } from '@ngx-translate/core';


@Component({
	selector: 'intersection-list',
	imports: [CommonModule,Card, TableModule, TranslatePipe, RouterLink],
	templateUrl: './list.html',
	styleUrl: './list.scss',
})
export class IntersectionList<T extends BaseRow> {
	private readonly _router = inject(Router);
	private readonly _activatedRoute = inject(ActivatedRoute);
	private readonly queryParams = toSignal(this._activatedRoute.queryParams);

	rows = input.required<T[]>();
	columns = input.required<ListColumn<T>[]>();
	protected readonly loading = signal(false);

	rowFocused = output<T>();
	
	protected highlightedRowId = computed(() => {
        const params = this.queryParams();
        return params?.['id'] ? Number(params['id']) : null;
    });
	
	onRowAction(row: T) {
        this.rowFocused.emit(row);
    }
}
