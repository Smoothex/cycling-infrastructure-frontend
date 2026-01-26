import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MapDetail } from './map-detail';

describe('DetailComponent', () => {
	let component: MapDetail;
	let fixture: ComponentFixture<MapDetail>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [MapDetail],
		}).compileComponents();

		fixture = TestBed.createComponent(MapDetail);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
