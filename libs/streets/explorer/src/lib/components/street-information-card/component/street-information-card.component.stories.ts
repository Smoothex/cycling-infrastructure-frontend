import { signal } from '@angular/core';
import { RouterTestingModule } from '@angular/router/testing';
import { Store } from '@ngxs/store';
import { ECyclewayType, EHighwayTypes, EParking } from '@simra/common-models';
import { StorybookTranslateModule } from '@simra/helpers';
import { IResponseStreet, ITags } from '@simra/streets-common';
import { Meta, moduleMetadata, StoryObj } from '@storybook/angular';
import { jest } from '@storybook/test';
import { StreetInformationCardComponent } from './street-information-card.component';

const mockStore = {
	selectSignal: jest.fn(), // ✅ Mock NGXS selectSignal
};

const meta: Meta<StreetInformationCardComponent> = {
	component: StreetInformationCardComponent,
	title: 'StreetInformationCard',
	decorators: [
		moduleMetadata({
			providers: [{ provide: Store, useValue: mockStore }],
			imports: [StorybookTranslateModule, RouterTestingModule],
		}),
	],
};
export default meta;
type Story = StoryObj<StreetInformationCardComponent>;

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
					rideIncident: [],
					safetyMetricPlanetOsmLines: [],
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
			return { template: `<m-street-information-card></m-street-information-card>` };
		},
	],
};

export const Loading: Story = {
	decorators: [
		() => {
			mockStore.selectSignal.mockReturnValue(signal({} as IResponseStreet));
			return { template: `<m-street-information-card></m-street-information-card>` };
		},
	],
};
