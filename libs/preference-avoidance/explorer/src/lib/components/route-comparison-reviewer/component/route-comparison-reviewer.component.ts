import { DatePipe, DecimalPipe, PercentPipe } from '@angular/common';
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	effect,
	HostListener,
	inject,
	OnDestroy,
	output,
	resource,
	signal,
	ViewEncapsulation,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MapPage } from '@simra/common-components';
import { APP_CONFIG } from '@simra/common-models';
import {
	ManualRouteComparisonClassification,
	RouteComparisonReviewIssue,
	RouteComparisonType,
	RouteReview,
	RouteReviewDetail,
	RouteReviewSample,
	RouteReviewSampleItem,
} from '@simra/preference-avoidance-common';
import { PreferenceAvoidanceAnalysisFacade } from '@simra/preference-avoidance-domain';
import { Feature, FeatureCollection, LineString, Point } from 'geojson';
import * as maplibregl from 'maplibre-gl';
import { PrimeTemplate } from 'primeng/api';
import { Card } from 'primeng/card';
import { Skeleton } from 'primeng/skeleton';
import { firstValueFrom } from 'rxjs';

type ReviewerMode = 'EXPLORE' | 'REVIEW';
type ReviewStateFilter = 'ALL' | 'REVIEWED' | 'UNREVIEWED';
type AutomatedClassFilter = 'ALL' | RouteComparisonType;
type MapBaseStyle = 'MAP' | 'SATELLITE';
type PendingNavigation = { kind: 'RIDE'; rideId: string } | { kind: 'MODE'; mode: ReviewerMode };

interface Choice<T> {
	value: T;
	label: string;
	description: string;
}

const observedRouteSource = 'route-review-observed-source';
const observedRouteLayer = 'route-review-observed-layer';
const shortestRouteSource = 'route-review-shortest-source';
const shortestRouteLayer = 'route-review-shortest-layer';
const signalSource = 'route-review-signals-source';
const preferredSignalLayer = 'route-review-preferred-layer';
const avoidedSignalLayer = 'route-review-avoided-layer';
const endpointSource = 'route-review-endpoints-source';
const endpointLayer = 'route-review-endpoints-layer';

const routeClassDefinitions: Record<
	RouteComparisonType,
	{ label: string; explanation: string; color: string }
> = {
	EQUIVALENT_ROUTE: {
		label: 'Within distance tolerance',
		explanation:
			'The observed route stays within both excess-distance limits. Route overlap does not determine this class.',
		color: '#2563eb',
	},
	LOCAL_DETOUR: {
		label: 'Local detour',
		explanation:
			'The observed route exceeds at least one distance limit and retains enough shortest-route overlap to represent a local detour.',
		color: '#d97706',
	},
	CORRIDOR_ALTERNATIVE: {
		label: 'Corridor alternative',
		explanation:
			'The observed route exceeds at least one distance limit and has too little shortest-route overlap, indicating a different corridor.',
		color: '#7c3aed',
	},
};

const manualChoices: Choice<ManualRouteComparisonClassification>[] = [
	{
		value: 'EQUIVALENT_ROUTE',
		label: 'Equivalent route',
		description: 'Same practical route with only minor variation.',
	},
	{
		value: 'LOCAL_DETOUR',
		label: 'Local detour',
		description: 'A local deviation while retaining the main corridor.',
	},
	{
		value: 'CORRIDOR_ALTERNATIVE',
		label: 'Corridor alternative',
		description: 'A materially different corridor between origin and destination.',
	},
	{
		value: 'UNCERTAIN',
		label: 'Uncertain',
		description: 'The available evidence does not support a confident class.',
	},
	{
		value: 'UNUSABLE',
		label: 'Unusable',
		description: 'Route or reference data is too flawed for comparison.',
	},
];

const issueChoices: Choice<RouteComparisonReviewIssue>[] = [
	{
		value: 'MAP_MATCHING_ERROR',
		label: 'Map-matching error',
		description: 'Observed route appears assigned to the wrong street.',
	},
	{
		value: 'IMPLAUSIBLE_REFERENCE_ROUTE',
		label: 'Implausible reference route',
		description: 'The shortest route is not a credible cycling option.',
	},
	{
		value: 'LIKELY_INTERMEDIATE_STOP',
		label: 'Likely intermediate stop',
		description: 'The ride appears to include a stop or additional destination.',
	},
	{
		value: 'INCORRECT_DIVERGENT_SEGMENTS',
		label: 'Incorrect divergent segments',
		description: 'Preferred or avoided signals do not match the route difference.',
	},
	{
		value: 'POOR_GPS_QUALITY',
		label: 'Poor GPS quality',
		description: 'Location accuracy makes the comparison unreliable.',
	},
	{
		value: 'OTHER',
		label: 'Other',
		description: 'Another issue described in the notes.',
	},
];

@Component({
	selector: 't-route-comparison-reviewer',
	standalone: true,
	imports: [
		FormsModule,
		MapPage,
		Card,
		Skeleton,
		PrimeTemplate,
		DatePipe,
		DecimalPipe,
		PercentPipe,
	],
	templateUrl: './route-comparison-reviewer.component.html',
	styleUrl: './route-comparison-reviewer.component.scss',
	encapsulation: ViewEncapsulation.None,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 't-route-comparison-reviewer' },
})
export class RouteComparisonReviewerComponent implements OnDestroy {
	private readonly _facade = inject(PreferenceAvoidanceAnalysisFacade);
	private readonly _mapTilerToken = inject(APP_CONFIG).mapTilerToken;
	private readonly _map = signal<maplibregl.Map | undefined>(undefined);
	private _signalPopup?: maplibregl.Popup;
	private _draftRideId?: string;
	public readonly dirtyChange = output<boolean>();

	protected readonly mode = signal<ReviewerMode>('EXPLORE');
	protected readonly selectedRideId = signal<string | undefined>(undefined);
	protected readonly automatedClassFilter = signal<AutomatedClassFilter>('ALL');
	protected readonly reviewStateFilter = signal<ReviewStateFilter>('ALL');
	protected readonly selectedMapBaseStyle = signal<MapBaseStyle>('MAP');
	protected readonly manualClassification = signal<
		ManualRouteComparisonClassification | undefined
	>(undefined);
	protected readonly selectedIssueCodes = signal<RouteComparisonReviewIssue[]>([]);
	protected readonly reviewNotes = signal('');
	protected readonly draftDirty = signal(false);
	protected readonly saving = signal(false);
	protected readonly formError = signal<string | undefined>(undefined);
	protected readonly saveMessage = signal<string | undefined>(undefined);
	protected readonly pendingNavigation = signal<PendingNavigation | undefined>(undefined);

	protected readonly routeClassDefinitions = routeClassDefinitions;
	protected readonly manualChoices = manualChoices;
	protected readonly issueChoices = issueChoices;
	protected readonly automatedClassOptions: { value: AutomatedClassFilter; label: string }[] = [
		{ value: 'ALL', label: 'All classes' },
		...Object.entries(routeClassDefinitions).map(([value, definition]) => ({
			value: value as RouteComparisonType,
			label: definition.label,
		})),
	];
	protected readonly reviewStateOptions: { value: ReviewStateFilter; label: string }[] = [
		{ value: 'ALL', label: 'All review states' },
		{ value: 'UNREVIEWED', label: 'Unreviewed' },
		{ value: 'REVIEWED', label: 'Reviewed' },
	];

	protected readonly sample = resource<RouteReviewSample | undefined, unknown>({
		loader: async () => firstValueFrom(this._facade.getRouteReviewSample()),
	});

	protected readonly detail = resource<RouteReviewDetail | undefined, string | undefined>({
		params: () => this.selectedRideId(),
		loader: async ({ params: rideId }) =>
			rideId ? firstValueFrom(this._facade.getRouteReviewDetail(rideId)) : undefined,
	});

	protected readonly navigationItems = computed(() => {
		const items = this.sample.value()?.items ?? [];
		return items.filter((item) => {
			const classMatches =
				this.automatedClassFilter() === 'ALL' ||
				item.automatedClassification === this.automatedClassFilter();
			const reviewMatches =
				this.reviewStateFilter() === 'ALL' ||
				(this.reviewStateFilter() === 'REVIEWED'
					? item.review !== undefined
					: !item.review);
			return classMatches && reviewMatches;
		});
	});

	protected readonly selectedItem = computed(() =>
		this.sample.value()?.items.find((item) => item.rideId === this.selectedRideId()),
	);

	protected readonly navigationIndex = computed(() =>
		this.navigationItems().findIndex((item) => item.rideId === this.selectedRideId()),
	);

	protected readonly unreviewedCount = computed(
		() => this.sample.value()?.items.filter((item) => !item.review).length ?? 0,
	);

	protected readonly validationSummary = computed(() => {
		const reviewedItems = (this.sample.value()?.items ?? []).filter((item) => item.review);
		const comparableItems = reviewedItems.filter((item) =>
			this.isAutomatedClass(item.review?.manualClassification),
		);
		const agreements = comparableItems.filter(
			(item) => item.review?.manualClassification === item.automatedClassification,
		).length;
		const perClass = (Object.keys(routeClassDefinitions) as RouteComparisonType[]).map(
			(routeClass) => {
				const comparableForClass = comparableItems.filter(
					(item) => item.automatedClassification === routeClass,
				);
				return {
					routeClass,
					label: routeClassDefinitions[routeClass].label,
					agreements: comparableForClass.filter(
						(item) => item.review?.manualClassification === routeClass,
					).length,
					comparable: comparableForClass.length,
				};
			},
		);
		return {
			reviewed: reviewedItems.length,
			comparable: comparableItems.length,
			agreements,
			agreementRatio: comparableItems.length
				? agreements / comparableItems.length
				: undefined,
			uncertain: reviewedItems.filter(
				(item) => item.review?.manualClassification === 'UNCERTAIN',
			).length,
			unusable: reviewedItems.filter(
				(item) => item.review?.manualClassification === 'UNUSABLE',
			).length,
			perClass,
		};
	});

	constructor() {
		effect(() => this.dirtyChange.emit(this.draftDirty()));

		effect(() => {
			const items = this.sample.value()?.items;
			if (!items?.length || this.selectedRideId()) {
				return;
			}
			this.selectedRideId.set(items[0].rideId);
		});

		effect(() => {
			const detail = this.detail.value();
			if (!detail || this._draftRideId === detail.rideId) {
				return;
			}
			this._draftRideId = detail.rideId;
			this.manualClassification.set(detail.review?.manualClassification);
			this.selectedIssueCodes.set(detail.review?.issueCodes ?? []);
			this.reviewNotes.set(detail.review?.notes ?? '');
			this.draftDirty.set(false);
			this.formError.set(undefined);
		});

		effect(() => {
			const map = this._map();
			const detail = this.detail.value();
			if (map && detail && map.isStyleLoaded()) {
				this.renderRouteComparison(map, detail);
			}
		});
	}

	public ngOnDestroy(): void {
		this._signalPopup?.remove();
	}

	@HostListener('window:beforeunload', ['$event'])
	public onBeforeUnload(event: BeforeUnloadEvent): void {
		if (!this.draftDirty()) {
			return;
		}
		event.preventDefault();
		event.returnValue = '';
	}

	protected onMapReady(map: maplibregl.Map): void {
		map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), 'top-right');
		map.addControl(new maplibregl.FullscreenControl(), 'top-right');
		map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
		map.on('click', (event) => this.onMapClick(map, event));
		map.on('mousemove', (event) => this.onMapPointerMove(map, event));
		this._map.set(map);
	}

	protected onModeChange(mode: ReviewerMode): void {
		if (mode === this.mode()) {
			return;
		}
		this.requestNavigation({ kind: 'MODE', mode });
	}

	protected onAutomatedClassFilterChange(value: AutomatedClassFilter): void {
		this.automatedClassFilter.set(value);
		this.selectFirstVisibleItem();
	}

	protected onReviewStateFilterChange(value: ReviewStateFilter): void {
		this.reviewStateFilter.set(value);
		this.selectFirstVisibleItem();
	}

	protected onPrevious(): void {
		this.navigateBy(-1);
	}

	protected onNext(): void {
		this.navigateBy(1);
	}

	protected onManualClassificationChange(
		classification: ManualRouteComparisonClassification,
	): void {
		this.manualClassification.set(classification);
		this.markDraftChanged();
	}

	protected onIssueToggle(issue: RouteComparisonReviewIssue, selected: boolean): void {
		this.selectedIssueCodes.update((issues) =>
			selected ? [...issues, issue] : issues.filter((candidate) => candidate !== issue),
		);
		this.markDraftChanged();
	}

	protected onNotesChange(notes: string): void {
		this.reviewNotes.set(notes);
		this.markDraftChanged();
	}

	protected isIssueSelected(issue: RouteComparisonReviewIssue): boolean {
		return this.selectedIssueCodes().includes(issue);
	}

	protected async onSaveReview(): Promise<void> {
		const rideId = this.selectedRideId();
		const classification = this.manualClassification();
		if (!rideId || !classification) {
			this.formError.set('Select a manual classification before saving.');
			return;
		}
		const notes = this.reviewNotes().trim();
		if (this.isIssueSelected('OTHER') && !notes) {
			this.formError.set('Add a note when “Other” is selected.');
			return;
		}

		this.saving.set(true);
		this.formError.set(undefined);
		this.saveMessage.set(undefined);
		try {
			const review = await firstValueFrom(
				this._facade.saveRouteReview(rideId, {
					manualClassification: classification,
					issueCodes: this.selectedIssueCodes(),
					notes: notes || undefined,
				}),
			);
			const item = this.selectedItem();
			const wasReviewed = item?.review !== undefined;
			this.applySavedReview(rideId, review, wasReviewed);
			this.draftDirty.set(false);
			this.saveMessage.set(
				item?.automatedClassification === review.manualClassification
					? 'Saved - the manual review agrees with the automated class.'
					: 'Saved - the manual review differs from the automated class.',
			);
			const nextRide = this.nextUnreviewedRide(rideId);
			if (nextRide) {
				if (
					this.automatedClassFilter() !== 'ALL' &&
					nextRide.automatedClassification !== this.automatedClassFilter()
				) {
					this.automatedClassFilter.set('ALL');
				}
				this.applyRideSelection(nextRide.rideId);
			} else {
				this.detail.update((detail) => (detail ? { ...detail, review } : detail));
			}
		} catch {
			this.formError.set('The review could not be saved. Your selections are still here.');
		} finally {
			this.saving.set(false);
		}
	}

	protected keepEditing(): void {
		this.pendingNavigation.set(undefined);
	}

	protected discardAndContinue(): void {
		const pending = this.pendingNavigation();
		this.pendingNavigation.set(undefined);
		this.draftDirty.set(false);
		if (pending?.kind === 'RIDE') {
			this.applyRideSelection(pending.rideId);
		} else if (pending?.kind === 'MODE') {
			this.applyMode(pending.mode);
		}
	}

	protected onMapBaseStyleChange(style: MapBaseStyle): void {
		if (style === this.selectedMapBaseStyle()) {
			return;
		}
		this.selectedMapBaseStyle.set(style);
		const map = this._map();
		if (!map) {
			return;
		}
		map.setStyle(this.mapBaseStyleUrl(style));
		map.once('style.load', () => {
			const detail = this.detail.value();
			if (detail) {
				this.renderRouteComparison(map, detail);
			}
		});
	}

	protected routeClassLabel(routeClass: RouteComparisonType): string {
		return routeClassDefinitions[routeClass].label;
	}

	protected formatEnum(value?: string): string {
		return value
			? value
					.toLowerCase()
					.split('_')
					.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
					.join(' ')
			: 'Not recorded';
	}

	protected formatDuration(seconds?: number): string {
		if (seconds === undefined) {
			return 'Not recorded';
		}
		const hours = Math.floor(seconds / 3_600);
		const minutes = Math.round((seconds % 3_600) / 60);
		return hours ? `${hours} h ${minutes} min` : `${minutes} min`;
	}

	protected detourGaugePercent(detail: RouteReviewDetail): number {
		return Math.min(100, Math.max(0, (detail.relativeDetourRatio ?? 0) * 200));
	}

	protected detourThresholdPercent(detail: RouteReviewDetail): number {
		return Math.min(100, detail.detourThresholdRatio * 200);
	}

	protected overlapGaugePercent(detail: RouteReviewDetail): number {
		return Math.min(100, Math.max(0, (detail.overlapRatio ?? 0) * 100));
	}

	protected overlapThresholdPercent(detail: RouteReviewDetail): number {
		return Math.min(100, detail.minimumOverlapRatio * 100);
	}

	protected signalCount(
		detail: RouteReviewDetail,
		eventType: 'PREFERENCE' | 'AVOIDANCE',
	): number {
		return detail.signals.filter((signal) => signal.eventType === eventType).length;
	}

	protected agreementPercent(agreements: number, comparable: number): string {
		return comparable ? `${Math.round((agreements / comparable) * 100)}%` : '—';
	}

	protected confusionCount(
		automatedClassification: RouteComparisonType,
		manualClassification: ManualRouteComparisonClassification,
	): number {
		return (this.sample.value()?.items ?? []).filter(
			(item) =>
				item.automatedClassification === automatedClassification &&
				item.review?.manualClassification === manualClassification,
		).length;
	}

	private navigateBy(offset: -1 | 1): void {
		const items = this.navigationItems();
		if (!items.length) {
			return;
		}
		const index = this.navigationIndex();
		const nextIndex = index < 0 ? 0 : (index + offset + items.length) % items.length;
		this.requestNavigation({ kind: 'RIDE', rideId: items[nextIndex].rideId });
	}

	private requestNavigation(pending: PendingNavigation): void {
		if (this.mode() === 'REVIEW' && this.draftDirty()) {
			this.pendingNavigation.set(pending);
			return;
		}
		if (pending.kind === 'RIDE') {
			this.applyRideSelection(pending.rideId);
		} else {
			this.applyMode(pending.mode);
		}
	}

	private applyMode(mode: ReviewerMode): void {
		this.mode.set(mode);
		this.reviewStateFilter.set(mode === 'REVIEW' ? 'UNREVIEWED' : 'ALL');
		this.saveMessage.set(undefined);
		this.selectFirstVisibleItem();
	}

	private selectFirstVisibleItem(): void {
		const first = this.navigationItems()[0];
		if (first) {
			this.requestNavigation({ kind: 'RIDE', rideId: first.rideId });
		}
	}

	private applyRideSelection(rideId: string): void {
		if (rideId === this.selectedRideId()) {
			return;
		}
		this._draftRideId = undefined;
		this.selectedRideId.set(rideId);
		this.pendingNavigation.set(undefined);
		this.formError.set(undefined);
		this._signalPopup?.remove();
	}

	private markDraftChanged(): void {
		this.draftDirty.set(true);
		this.formError.set(undefined);
		this.saveMessage.set(undefined);
	}

	private applySavedReview(rideId: string, review: RouteReview, wasReviewed: boolean): void {
		this.sample.update((sample) =>
			sample
				? {
						...sample,
						reviewedItems: sample.reviewedItems + (wasReviewed ? 0 : 1),
						items: sample.items.map((item) =>
							item.rideId === rideId ? { ...item, review } : item,
						),
					}
				: sample,
		);
	}

	private nextUnreviewedRide(currentRideId: string): RouteReviewSampleItem | undefined {
		const sampleItems = this.sample.value()?.items ?? [];
		const classFilter = this.automatedClassFilter();
		const allCandidates = sampleItems.filter(
			(item) => !item.review && item.rideId !== currentRideId,
		);
		const candidates = allCandidates.filter(
			(item) => classFilter === 'ALL' || item.automatedClassification === classFilter,
		);
		const currentOrder = this.selectedItem()?.sampleOrder ?? 0;
		return (
			candidates.find((item) => item.sampleOrder > currentOrder) ??
			candidates[0] ??
			allCandidates.find((item) => item.sampleOrder > currentOrder) ??
			allCandidates[0]
		);
	}

	private isAutomatedClass(
		classification?: ManualRouteComparisonClassification,
	): classification is RouteComparisonType {
		return classification !== undefined && classification in routeClassDefinitions;
	}

	private renderRouteComparison(map: maplibregl.Map, detail: RouteReviewDetail): void {
		this.setGeoJsonSource(map, observedRouteSource, {
			type: 'Feature',
			properties: {},
			geometry: detail.observedRoute,
		});
		this.setGeoJsonSource(map, shortestRouteSource, {
			type: 'Feature',
			properties: {},
			geometry: detail.shortestRoute,
		});
		const signalFeatures: Feature<LineString>[] = detail.signals.map((signal) => ({
			type: 'Feature',
			properties: {
				eventType: signal.eventType,
				streetName: signal.streetName ?? 'Unnamed street',
				segmentId: signal.segmentId,
			},
			geometry: signal.geometry,
		}));
		this.setGeoJsonSource(map, signalSource, {
			type: 'FeatureCollection',
			features: signalFeatures,
		});
		const routeCoordinates = detail.observedRoute.coordinates;
		const endpoints: Feature<Point>[] = routeCoordinates.length
			? [
					{
						type: 'Feature',
						properties: { endpoint: 'Start' },
						geometry: { type: 'Point', coordinates: routeCoordinates[0] },
					},
					{
						type: 'Feature',
						properties: { endpoint: 'Destination' },
						geometry: {
							type: 'Point',
							coordinates: routeCoordinates[routeCoordinates.length - 1],
						},
					},
				]
			: [];
		this.setGeoJsonSource(map, endpointSource, {
			type: 'FeatureCollection',
			features: endpoints,
		});
		this.ensureRouteLayers(map);
		this.fitRoutes(map, detail);
	}

	private setGeoJsonSource(
		map: maplibregl.Map,
		sourceId: string,
		data: Feature<LineString> | FeatureCollection<LineString> | FeatureCollection<Point>,
	): void {
		const source = map.getSource(sourceId) as maplibregl.GeoJSONSource | undefined;
		if (source) {
			source.setData(data);
		} else {
			map.addSource(sourceId, { type: 'geojson', data });
		}
	}

	private ensureRouteLayers(map: maplibregl.Map): void {
		if (!map.getLayer(shortestRouteLayer)) {
			map.addLayer({
				id: shortestRouteLayer,
				type: 'line',
				source: shortestRouteSource,
				paint: { 'line-color': '#64748b', 'line-width': 4, 'line-opacity': 0.9 },
				layout: { 'line-cap': 'round', 'line-join': 'round' },
			});
			map.setPaintProperty(shortestRouteLayer, 'line-dasharray', [2, 2]);
		}
		if (!map.getLayer(observedRouteLayer)) {
			map.addLayer({
				id: observedRouteLayer,
				type: 'line',
				source: observedRouteSource,
				paint: { 'line-color': '#2563eb', 'line-width': 5, 'line-opacity': 0.9 },
				layout: { 'line-cap': 'round', 'line-join': 'round' },
			});
		}
		if (!map.getLayer(preferredSignalLayer)) {
			map.addLayer({
				id: preferredSignalLayer,
				type: 'line',
				source: signalSource,
				filter: ['==', ['get', 'eventType'], 'PREFERENCE'],
				paint: { 'line-color': '#15803d', 'line-width': 8, 'line-opacity': 0.95 },
				layout: { 'line-cap': 'round', 'line-join': 'round' },
			});
		}
		if (!map.getLayer(avoidedSignalLayer)) {
			map.addLayer({
				id: avoidedSignalLayer,
				type: 'line',
				source: signalSource,
				filter: ['==', ['get', 'eventType'], 'AVOIDANCE'],
				paint: { 'line-color': '#dc2626', 'line-width': 8, 'line-opacity': 0.95 },
				layout: { 'line-cap': 'round', 'line-join': 'round' },
			});
			map.setPaintProperty(avoidedSignalLayer, 'line-dasharray', [1, 1]);
		}
		if (!map.getLayer(endpointLayer)) {
			map.addLayer({
				id: endpointLayer,
				type: 'circle',
				source: endpointSource,
				paint: {
					'circle-radius': 7,
					'circle-color': ['match', ['get', 'endpoint'], 'Start', '#ffffff', '#0f172a'],
					'circle-stroke-color': '#0f172a',
					'circle-stroke-width': 2,
				},
			});
		}
	}

	private fitRoutes(map: maplibregl.Map, detail: RouteReviewDetail): void {
		const coordinates = [
			...detail.observedRoute.coordinates,
			...detail.shortestRoute.coordinates,
		];
		if (!coordinates.length) {
			return;
		}
		const bounds = coordinates.reduce(
			(currentBounds, coordinate) => currentBounds.extend(coordinate as [number, number]),
			new maplibregl.LngLatBounds(
				coordinates[0] as [number, number],
				coordinates[0] as [number, number],
			),
		);
		map.fitBounds(bounds, { padding: 55, maxZoom: 16, duration: 500 });
	}

	private onMapClick(map: maplibregl.Map, event: maplibregl.MapMouseEvent): void {
		const layers = [preferredSignalLayer, avoidedSignalLayer].filter((layer) =>
			Boolean(map.getLayer(layer)),
		);
		if (!layers.length) {
			return;
		}
		const feature = map.queryRenderedFeatures(event.point, { layers })[0];
		if (!feature) {
			return;
		}
		const eventType = feature.properties?.['eventType'];
		const popup = document.createElement('div');
		popup.className = 'route-review-map-popup';
		const title = document.createElement('strong');
		title.textContent = feature.properties?.['streetName'] ?? 'Unnamed street';
		const signal = document.createElement('span');
		signal.textContent = eventType === 'PREFERENCE' ? 'Preferred segment' : 'Avoided segment';
		popup.append(title, signal);
		this._signalPopup?.remove();
		this._signalPopup = new maplibregl.Popup({ closeButton: true, offset: 10 })
			.setLngLat(event.lngLat)
			.setDOMContent(popup)
			.addTo(map);
	}

	private onMapPointerMove(map: maplibregl.Map, event: maplibregl.MapMouseEvent): void {
		const layers = [preferredSignalLayer, avoidedSignalLayer].filter((layer) =>
			Boolean(map.getLayer(layer)),
		);
		map.getCanvas().style.cursor =
			layers.length && map.queryRenderedFeatures(event.point, { layers }).length
				? 'pointer'
				: '';
	}

	private mapBaseStyleUrl(style: MapBaseStyle): string {
		const styleId = style === 'SATELLITE' ? 'satellite' : 'basic-v2';
		return `https://api.maptiler.com/maps/${styleId}/style.json?key=${this._mapTilerToken}`;
	}
}
