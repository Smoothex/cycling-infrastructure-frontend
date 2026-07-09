import { Route } from '@angular/router';

export const PREFERENCE_AVOIDANCE_SHELL_ROUTES: Route[] = [
	{
		path: '',
		pathMatch: 'full',
		loadComponent: () =>
			import('@simra/preference-avoidance-explorer').then((m) => m.PreferenceAvoidancePage),
	},
	{
		path: '**',
		redirectTo: '',
	},
];
