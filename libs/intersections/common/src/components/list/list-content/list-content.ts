import { Component, input, inject, output, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { TranslatePipe } from '@ngx-translate/core';
import { Button } from 'primeng/button';
import { Tooltip } from 'primeng/tooltip';
import { IntersectionRow, ListColumn } from '../../../lib/common/interfaces';


@Component({
	// eslint-disable-next-line @angular-eslint/component-selector
	selector: '[intersection-list-content]',
	standalone: true,
	imports: [CommonModule, TranslatePipe, RouterLink, Button, Tooltip],
	templateUrl: './list-content.html',
})
export class IntersectionListContentComponent<T extends IntersectionRow> {
	private readonly _activatedRoute = inject(ActivatedRoute);
	private readonly queryParams = toSignal(this._activatedRoute.queryParams);

	public row = input.required<T>();
    public columns = input.required<ListColumn<T>[]>();
    public action = output<T>();

	protected getFieldValue(field: keyof T): any {
        return this.row()[field];
    }

	protected highlightedRowId = computed(() => {
        const params = this.queryParams();
        return params?.['id'] ? Number(params['id']) : null;
    });
}
