import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IntersectionsMap } from './map';

describe('MapComponent', () => {
	let component: IntersectionsMap;
	let fixture: ComponentFixture<IntersectionsMap>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [IntersectionsMap],
		}).compileComponents();

		fixture = TestBed.createComponent(IntersectionsMap);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
