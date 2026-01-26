import { Route } from '@angular/router';
import { UrlMatchResult, UrlSegment } from '@angular/router';

function isNumber(input: string) {
	return /^\d+$/.test(input);
}

function startEndMatcher(segments: UrlSegment[]): UrlMatchResult | null {
	if (
		segments.length === 4 &&
		segments[0].path === "node" && 
		isNumber(segments[1].path) &&
		(isNumber(segments[2].path) || segments[2].path === "null") &&
		(isNumber(segments[3].path) || segments[3].path === "null")
	) {
		return {
			consumed: segments,
			posParams: {
				displayNodes: segments[0],
				trafficSignalClusterId: segments[1],
				startOsmId: segments[2],
				endOsmId: segments[3],
			},
		};
	}
	return null;
}

function numberMatcher(segments: UrlSegment[]): UrlMatchResult | null {
	if (segments.length === 2 && 
		segments[0].path === "node" && 
		isNumber(segments[1].path)
	) {
		return {
			consumed: segments,
			posParams: { trafficSignalClusterId: segments[1] }
		};
	}
	return null;
}

function prevOsmNextMatcher(segments: UrlSegment[]): UrlMatchResult | null {
	if (
		segments.length === 4 &&
		segments[0].path === "edge" && 
		(isNumber(segments[1].path) || segments[1].path === "null") &&
		(isNumber(segments[2].path) || segments[2].path === "null") &&
		(isNumber(segments[3].path) || segments[3].path === "null")
	) {
		return {
			consumed: segments,
			posParams: {
				displayNodes: segments[0],
				prevOsmId: segments[1],
				osmId: segments[2],
				nextOsmId: segments[3],
			},
		};
	}
	return null;
}

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
		path: 'regions/:regionName',
		loadComponent: () =>
			import("@simra/intersections-region-detail").then((m) => m.IntersectionsRegionDetail)
	},
	{
		path: 'regions',
		loadComponent: () =>
			import('@simra/intersections-region-list').then((m) => m.IntersectionsRegionList),
	},
	{
		matcher: numberMatcher,
		loadComponent: () =>
			import('@simra/intersections-aggregate').then((m) => m.IntersectionsAggregatePage),
	},
	{
		matcher: startEndMatcher,
		loadComponent: () =>
			import('@simra/intersections-detail').then((m) => m.IntersectionsDetailPage),
	},
	{
		matcher: prevOsmNextMatcher,
		loadComponent: () =>
			import('@simra/intersections-detail').then((m) => m.IntersectionsDetailPage),
	},
	{
		path: '**',
		redirectTo: '',
	},
];