import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IntersectionsAggregateList } from './list-aggregate';

describe('DetailComponent', () => {
	let component: IntersectionsAggregateList;
	let fixture: ComponentFixture<IntersectionsAggregateList>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [IntersectionsAggregateList],
		}).compileComponents();

		fixture = TestBed.createComponent(IntersectionsAggregateList);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
