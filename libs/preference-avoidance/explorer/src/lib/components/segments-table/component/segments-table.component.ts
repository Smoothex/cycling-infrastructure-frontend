import { DecimalPipe } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	input,
	output,
	signal,
	ViewEncapsulation,
} from '@angular/core';
import { SegmentSummary } from '@simra/preference-avoidance-common';
import { SortEvent } from 'primeng/api';
import { Card } from 'primeng/card';
import { TableModule } from 'primeng/table';

/**
 * Sortable, paginated table of street segments. Receives the already-filtered
 * segment pool and owns only the sorting; row clicks and hovers are emitted so
 * the parent can drive map selection and highlighting.
 */
@Component({
	selector: 't-segments-table',
	standalone: true,
	imports: [Card, TableModule, DecimalPipe],
	templateUrl: './segments-table.component.html',
	styleUrl: './segments-table.component.scss',
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: {
		class: 't-segments-table',
	},
})
export class SegmentsTableComponent {
	public readonly segments = input.required<SegmentSummary[]>();
	public readonly loading = input(false);
	public readonly selectedSegmentId = input<number | undefined>(undefined);
	public readonly rowSelected = output<number>();
	public readonly rowHovered = output<number | undefined>();

	protected readonly sortField = signal<string>('avoidanceCount');
	protected readonly sortOrder = signal<1 | -1>(-1);

	protected readonly sortedSegments = computed(() => {
		const field = this.sortField();
		const order = this.sortOrder();
		return [...this.segments()].sort((a, b) => {
			const aVal = (a as unknown as Record<string, unknown>)[field] ?? 0;
			const bVal = (b as unknown as Record<string, unknown>)[field] ?? 0;
			if (typeof aVal === 'number' && typeof bVal === 'number') {
				return (aVal - bVal) * order;
			}
			return String(aVal).localeCompare(String(bVal)) * order;
		});
	});

	protected onSort(event: SortEvent): void {
		if (event.field) {
			this.sortField.set(event.field);
		}
		this.sortOrder.set((event.order ?? -1) as 1 | -1);
	}

	protected formatPercent(value?: number): string {
		if (value === null || value === undefined) {
			return '-';
		}
		return `${(value * 100).toFixed(1)}%`;
	}
}
