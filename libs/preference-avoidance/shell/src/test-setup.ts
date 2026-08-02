import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';
import 'reflect-metadata';

setupZoneTestEnv({
	errorOnUnknownElements: true,
	errorOnUnknownProperties: true,
});
