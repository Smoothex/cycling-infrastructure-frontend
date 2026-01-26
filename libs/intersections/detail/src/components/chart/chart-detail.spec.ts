import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ChartDetail } from './chart-detail';

describe('DetailComponent', () => {
	let component: ChartDetail;
	let fixture: ComponentFixture<ChartDetail>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [ChartDetail],
		}).compileComponents();

		fixture = TestBed.createComponent(ChartDetail);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
