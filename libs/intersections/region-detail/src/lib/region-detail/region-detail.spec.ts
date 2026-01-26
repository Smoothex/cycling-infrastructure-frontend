import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IntersectionsRegionDetail } from './region-detail';

describe('RegionDetailComponent', () => {
	let component: IntersectionsRegionDetail;
	let fixture: ComponentFixture<IntersectionsRegionDetail>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [IntersectionsRegionDetail],
		}).compileComponents();

		fixture = TestBed.createComponent(IntersectionsRegionDetail);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
