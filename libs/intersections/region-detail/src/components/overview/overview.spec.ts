import { ComponentFixture, TestBed } from '@angular/core/testing';
import { OverviewRegionDetail } from './overview';

describe('DetailComponent', () => {
	let component: OverviewRegionDetail;
	let fixture: ComponentFixture<OverviewRegionDetail>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [OverviewRegionDetail],
		}).compileComponents();

		fixture = TestBed.createComponent(OverviewRegionDetail);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
