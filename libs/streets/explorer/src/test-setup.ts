globalThis.ngJest = {
	testEnvironmentOptions: {
		errorOnUnknownElements: true,
		errorOnUnknownProperties: true,
	},
};
import 'jest-canvas-mock';
import 'reflect-metadata';
import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv();
/* eslint-disable @typescript-eslint/no-empty-function */
global.ResizeObserver = class {
	observe() {}
	unobserve() {}
	disconnect() {}
};

Object.defineProperty(global.URL, 'createObjectURL', {
	writable: true,
	value: jest.fn(() => 'mocked-url'),
});
