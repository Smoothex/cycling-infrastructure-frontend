import { Route } from '@angular/router';
import { environment } from '../environments/environment';

const DEV_ROUTES: Route[] = [
	{
		path: 'rides',
		loadChildren: () => import('@simra/rides-shell').then((m) => m.RIDES_SHELL_ROUTES),
	}
];

const PRODUCTION_ROUTES: Route[] = [
	{
		path: 'incidents',
		loadChildren: () => import('@simra/incidents-shell').then((m) => m.RIDE_INCIDENT_SHELL_ROUTES),
	},
	{
		path: 'preference-and-avoidance',
		loadChildren: () => import('@simra/thesis-shell').then((m) => m.THESIS_SHELL_ROUTES),
	},
	{
		path: 'streets',
		loadChildren: () => import('@simra/streets-shell').then((m) => m.STREET_SHELL_ROUTES),
	},
	{
		path: 'administrative-districts',
		loadChildren: () => import('@simra/regions-shell').then((m) => m.REGION_SHELL_ROUTES),
	},
	{
		path: 'simra-regions',
		loadChildren: () => import('@simra/regions-shell').then((m) => m.SIMRA_REGION_SHELL_ROUTES),
	},
	{
		path: 'intersections',
		loadChildren: () => import('@simra/intersections-shell').then((m) => m.INTERSECTIONS_SHELL_ROUTES),
	},
	{
		path: '',
		pathMatch: 'full',
		loadComponent: () => import('./pages/home/components/home.page').then((m) => m.HomePage),
	},
	{
		path: 'not-found',
		loadComponent: () => import('./pages/not-found/not-found.page').then((m) => m.NotFoundPage),
	},
	{
		path: 'about',
		loadComponent: () => import('./pages/about/component/about.page').then((m) => m.AboutPage),
	},
	{
		path: 'processing-details',
		loadComponent: () => import('./pages/processing-details/compoments/processing-details.page').then((m) => m.ProcessingDetailsPage),
	},
	{
		path: '**',
		redirectTo: 'not-found',
	},
];

export const APP_ROUTES = [...(environment.production ? []: DEV_ROUTES), ...PRODUCTION_ROUTES];
