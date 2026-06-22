import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv();
Object.defineProperty(global.URL, 'createObjectURL', {
	writable: true,
	value: jest.fn(() => 'mocked-url'),
});
