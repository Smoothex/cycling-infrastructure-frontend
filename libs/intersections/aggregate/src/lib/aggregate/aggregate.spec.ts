import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IntersectionsAggregatePage } from './aggregate';

describe('DetailComponent', () => {
	let component: IntersectionsAggregatePage;
	let fixture: ComponentFixture<IntersectionsAggregatePage>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [IntersectionsAggregatePage],
		}).compileComponents();

		fixture = TestBed.createComponent(IntersectionsAggregatePage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
