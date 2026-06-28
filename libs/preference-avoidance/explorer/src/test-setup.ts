globalThis.ngJest = {
	testEnvironmentOptions: {
		errorOnUnknownElements: true,
		errorOnUnknownProperties: true,
	},
};
import 'reflect-metadata';
import 'jest-preset-angular/setup-jest';

/* eslint-disable @typescript-eslint/no-empty-function */
global.ResizeObserver = class {
	observe() {}
	unobserve() {}
	disconnect() {}
};
