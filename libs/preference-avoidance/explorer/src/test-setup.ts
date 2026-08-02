import 'jest-canvas-mock';
import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';
import 'reflect-metadata';

setupZoneTestEnv({
	errorOnUnknownElements: true,
	errorOnUnknownProperties: true,
});

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
