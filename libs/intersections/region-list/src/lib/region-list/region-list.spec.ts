import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IntersectionsRegionList } from './region-list';

describe('RegionComponent', () => {
	let component: IntersectionsRegionList;
	let fixture: ComponentFixture<IntersectionsRegionList>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [IntersectionsRegionList],
		}).compileComponents();

		fixture = TestBed.createComponent(IntersectionsRegionList);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
