import { ComponentFixture, TestBed } from '@angular/core/testing';
import { SegmentSummary } from '@simra/preference-avoidance-common';
import { SegmentsTableComponent } from './segments-table.component';

describe('SegmentsTableComponent', () => {
	let fixture: ComponentFixture<SegmentsTableComponent>;

	const segments: SegmentSummary[] = [
		{
			id: 2,
			streetName: 'Alexanderstraße',
			usageCount: 20,
			avoidanceCount: 4,
			avoidanceRatio: 0.2,
			preferenceCount: 2,
			preferenceRatio: 0.1,
			totalObservationCount: 26,
			incidentCount: 0,
			incidentBreakdown: [],
			externalFactors: [],
		},
		{
			id: 1,
			streetName: 'Zehlendorfer Straße',
			usageCount: 10,
			avoidanceCount: 8,
			avoidanceRatio: 0.44,
			preferenceCount: 1,
			preferenceRatio: 0.09,
			totalObservationCount: 19,
			incidentCount: 1,
			incidentBreakdown: [],
			externalFactors: [],
		},
	];

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [SegmentsTableComponent],
		}).compileComponents();

		fixture = TestBed.createComponent(SegmentsTableComponent);
		fixture.componentRef.setInput('segments', segments);
		fixture.detectChanges();
	});

	function renderedStreetNames(): string[] {
		return [...fixture.nativeElement.querySelectorAll('tbody tr td:first-child strong')]
			.map((cell: Element) => cell.textContent?.trim() ?? '');
	}

	it('sorts segments by avoidance count descending by default', () => {
		expect(renderedStreetNames()).toEqual(['Zehlendorfer Straße', 'Alexanderstraße']);
	});

	it('sorts by the selected column', () => {
		const streetHeader: HTMLTableCellElement = fixture.nativeElement.querySelector('th[pSortableColumn="streetName"]');

		streetHeader.click();
		fixture.detectChanges();

		expect(renderedStreetNames()).toEqual(['Alexanderstraße', 'Zehlendorfer Straße']);
	});

	it('emits row selection and hover changes', () => {
		const selected: number[] = [];
		const hovered: (number | undefined)[] = [];
		fixture.componentInstance.rowSelected.subscribe((segmentId) => selected.push(segmentId));
		fixture.componentInstance.rowHovered.subscribe((segmentId) => hovered.push(segmentId));
		const firstRow: HTMLTableRowElement = fixture.nativeElement.querySelector('tbody tr');

		firstRow.dispatchEvent(new MouseEvent('mouseenter'));
		firstRow.click();
		firstRow.dispatchEvent(new MouseEvent('mouseleave'));

		expect(selected).toEqual([1]);
		expect(hovered).toEqual([1, undefined]);
	});
});
