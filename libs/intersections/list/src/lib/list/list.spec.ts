import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IntersectionsList } from './list';

describe('ListComponent', () => {
	let component: IntersectionsList;
	let fixture: ComponentFixture<IntersectionsList>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [IntersectionsList],
		}).compileComponents();

		fixture = TestBed.createComponent(IntersectionsList);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
