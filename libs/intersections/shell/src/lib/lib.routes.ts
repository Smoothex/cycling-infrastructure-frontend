import { Route } from '@angular/router';

export const INTERSECTIONS_SHELL_ROUTES: Route[] = [
	{
		path: '',
		pathMatch: 'full',
		loadComponent: () =>
			import('@simra/intersections-list').then((m) => m.IntersectionsListComponent),
	},
	{
		path: 'map',
		loadComponent: () =>
			import('@simra/intersections-map').then((m) => m.IntersectionMapComponent),
	},
	{
		path: 'regions/:regionId',
		loadComponent: () =>
			import("@simra/intersections-region-detail").then((m) => m.IntersectionsRegionDetailComponent)
	},
	{
		path: 'regions',
		loadComponent: () =>
			import('@simra/intersections-region-list').then((m) => m.IntersectionsRegionListComponent),
	},
	{
		path: 'node/:nodeId',
		loadComponent: () =>
			import('@simra/intersections-aggregate').then((m) => m.IntersectionsAggregatePageComponent),
	},
	{
		path: 'edge/:edgeId',
		loadComponent: () =>
			import('@simra/intersections-aggregate').then((m) => m.IntersectionsAggregatePageComponent),
	},
	{
		path: 'segment/:id',
		loadComponent: () =>
			import('@simra/intersections-detail').then((m) => m.IntersectionsDetailPageComponent),
	},
	{
		path: '**',
		redirectTo: '',
	},
];