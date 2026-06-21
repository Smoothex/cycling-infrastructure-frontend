import 'reflect-metadata';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { APP_CONFIG } from '@simra/common-models';
import { RidesFacade } from '@simra/rides-domain';
import { of } from 'rxjs';
import { RidesMapPage } from './rides-map.page';

describe('RidesMapPage', () => {
	let component: RidesMapPage;
	let fixture: ComponentFixture<RidesMapPage>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [
				RidesMapPage,

				TranslateModule.forRoot()
			],
			providers: [
				provideRouter([]),
				{
					provide: RidesFacade,
					useValue: {
						getRideGeometries: jest.fn().mockReturnValue(of([
							[[0, 0], [1, 1]],
						])),
					}
				},
				{
					provide: APP_CONFIG,
					useValue: {
						mapTilerToken: '123'
					}
				},
			]
		}).compileComponents();

		fixture = TestBed.createComponent(RidesMapPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
