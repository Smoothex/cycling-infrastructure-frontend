import { signal } from '@angular/core';
import { RouterTestingModule } from '@angular/router/testing';
import { Store } from '@ngxs/store';
import { ECyclewayType, EHighwayTypes, EParking } from '@simra/common-models';
import { StorybookTranslateModule } from '@simra/helpers';
import { IResponseStreet, ITags } from '@simra/streets-common';
import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { jest } from '@storybook/test';
import { IncidentListComponent } from './incident-list.component';

const mockStore = {
	selectSignal: jest.fn(),
};

const meta: Meta<IncidentListComponent> = {
	component: IncidentListComponent,
	title: 'IncidentListComponent',
	decorators: [
		moduleMetadata({
			providers: [{ provide: Store, useValue: mockStore }],
			imports: [StorybookTranslateModule, RouterTestingModule],
		}),
	],
};
export default meta;
type Story = StoryObj<IncidentListComponent>;

export const Primary: Story = {
	decorators: [
		() => {
			mockStore.selectSignal.mockReturnValue(
				signal({
					id: 1,
					name: 'Main Street2',
					highway: EHighwayTypes.Primary,
					way: {
						type: 'LineString',
						coordinates: [
							[1491204.67354953, 6890863.81900039],
							[1491201.06679802, 6890875.77793645],
						],
					},
					safetyMetricPlanetOsmLines: [],
					rideIncident: [],
					tags: {
						maxSpeed: 50,
						lit: true,
						lanes: 3,
						cyclewayRight: {
							width: 1.5,
							type: ECyclewayType.ADVISORY,
						},
						cyclewayLeft: {
							width: 1.5,
							type: ECyclewayType.ADVISORY,
						},
						parkingLeft: {
							type: EParking.LANE,
						},
						parkingRight: {
							type: EParking.STREET_SIDE,
						},
					} as ITags,
				} as IResponseStreet),
			);
			return { template: `<m-incident-list></m-incident-list>` };
		},
	],
};

export const Loading: Story = {
	decorators: [
		() => {
			mockStore.selectSignal.mockReturnValue(signal({} as IResponseStreet));
			return { template: `<m-incident-list></m-incident-list>` };
		},
	],
};
