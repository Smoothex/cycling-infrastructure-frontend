import { Route } from '@angular/router';

export const INTERSECTIONS_SHELL_ROUTES: Route[] = [
	{
		path: '',
		pathMatch: 'full',
		loadComponent: () =>
			import('@simra/intersections-list').then((m) => m.IntersectionsList),
	},
	{
		path: 'map',
		loadComponent: () =>
			import('@simra/intersections-map').then((m) => m.IntersectionsMap),
	},
	{
		path: 'regions/:regionId',
		loadComponent: () =>
			import("@simra/intersections-region-detail").then((m) => m.IntersectionsRegionDetail)
	},
	{
		path: 'regions',
		loadComponent: () =>
			import('@simra/intersections-region-list').then((m) => m.IntersectionsRegionList),
	},
	{
		path: 'trafficSignalCluster/:trafficSignalClusterId',
		loadComponent: () =>
			import('@simra/intersections-aggregate').then((m) => m.IntersectionsAggregatePage),
	},
	{
		path: 'metric/:osmId',
		loadComponent: () =>
			import('@simra/intersections-aggregate').then((m) => m.IntersectionsAggregatePage),
	},
	{
		path: 'base/:id',
		loadComponent: () =>
			import('@simra/intersections-detail').then((m) => m.IntersectionsDetailPage),
	},
	{
		path: '**',
		redirectTo: '',
	},
];