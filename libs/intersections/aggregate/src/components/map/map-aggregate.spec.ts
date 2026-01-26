import { ComponentFixture, TestBed } from '@angular/core/testing';
import { IntersectionsAggregateMap } from './map-aggregate';

describe('DetailComponent', () => {
	let component: IntersectionsAggregateMap;
	let fixture: ComponentFixture<IntersectionsAggregateMap>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [IntersectionsAggregateMap],
		}).compileComponents();

		fixture = TestBed.createComponent(IntersectionsAggregateMap);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
