import { Route } from '@angular/router';

export const THESIS_SHELL_ROUTES: Route[] = [
	{
		path: '',
		pathMatch: 'full',
		loadComponent: () =>
			import('@simra/thesis-explorer').then((m) => m.PreferenceAvoidancePage),
	},
	{
		path: '**',
		redirectTo: '',
	},
];
