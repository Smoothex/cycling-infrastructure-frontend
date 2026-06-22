import 'reflect-metadata';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, RouterModule } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { provideStore } from '@ngxs/store';
import { APP_CONFIG } from '@simra/common-models';
import { MapFilterState } from '@simra/common-state';
import {
	RegionDetailState,
	RegionMapState,
	StreetDetailState,
	StreetDetailViewFacade,
	StreetMapState,
	StreetsMapFacade,
} from '@simra/streets-domain';
import { BehaviorSubject, of } from 'rxjs';
import { StreetsMapPage } from './streets-map.page';

describe('StreetsMapPage', () => {
	let component: StreetsMapPage;
	let fixture: ComponentFixture<StreetsMapPage>;

	beforeEach(async () => {
		await TestBed.configureTestingModule({
			imports: [StreetsMapPage, TranslateModule.forRoot(), RouterModule.forRoot([])],
			providers: [
				provideRouter([]),
				{
					provide: StreetsMapFacade,
					useValue: {
						fetchStreetInformation: jest.fn().mockReturnValue(
							new BehaviorSubject([
								[
									[0, 0],
									[1, 1],
								],
							]),
						),
						fetchLastMethodRun: jest.fn().mockReturnValue(of(new Date())),
						fetchStreetGrid: jest.fn().mockReturnValue([]),
						fetchRegionMap: jest.fn().mockReturnValue([]),
					},
				},
				{
					provide: StreetDetailViewFacade,
					useValue: {
						getIdOfNearestImage: jest.fn(),
					}
				},
				{
					provide: APP_CONFIG,
					useValue: {
						mapTilerToken: '123'
					}
				},
				provideStore([StreetMapState, MapFilterState, StreetDetailState, RegionDetailState, RegionMapState]),
			],
		}).compileComponents();

		fixture = TestBed.createComponent(StreetsMapPage);
		component = fixture.componentInstance;
		fixture.detectChanges();
	});

	it('should create', () => {
		expect(component).toBeTruthy();
	});
});
