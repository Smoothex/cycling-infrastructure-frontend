import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IntersectionsDetailPage } from './detail';

describe('LineDetailComponent', () => {
	let component: IntersectionsDetailPage;
	let fixture: ComponentFixture<IntersectionsDetailPage>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [IntersectionsDetailPage],
		}).compileComponents();

		fixture = TestBed.createComponent(IntersectionsDetailPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
