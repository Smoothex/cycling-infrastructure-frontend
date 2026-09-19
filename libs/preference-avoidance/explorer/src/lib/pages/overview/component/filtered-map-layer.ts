import { addProtocol, removeProtocol } from 'maplibre-gl';
import type { ErrorEvent, LineLayerSpecification, Map, MapSourceDataEvent } from 'maplibre-gl';

let nextProtocolId = 0;

export type FilteredMapState = 'idle' | 'loading' | 'ready' | 'error';

/** Each filter owns a source; reveal it only after the visible tiles have loaded. */
export class FilteredMapLayer {
	private generation = 0;
	private readonly protocol = `filtered-segments-${++nextProtocolId}`;
	private sourceId?: string;
	private url?: string;
	private state: FilteredMapState = 'idle';
	private deadline?: ReturnType<typeof setTimeout>;

	constructor(
		private readonly map: Map,
		private readonly layer: LineLayerSpecification,
		private readonly beforeLayer: string,
		private readonly onState: (state: FilteredMapState) => void,
	) {
		// MapLibre treats HTTP 404 as an absent tile without emitting an error. For this
		// API an empty result is HTTP 200; every failed response must fail the viewport.
		addProtocol(this.protocol, async (request, abortController) => {
			const response = await fetch(request.url.slice(this.protocol.length + 3), {
				signal: abortController.signal,
			});
			if (!response.ok) throw new Error(`Filtered map request failed (HTTP ${response.status})`);
			return { data: await response.arrayBuffer() };
		});
		map.on('render', this.checkComplete);
		map.on('sourcedataloading', this.onLoading);
		map.on('error', this.onError);
		map.on('movestart', this.onMove);
	}

	select(url?: string, retry = false): void {
		if (!retry && url === this.url && this.sourceId && this.map.getSource(this.sourceId))
			return;
		this.removeSource();
		this.url = url;
		if (!url) {
			this.setState('idle');
			return;
		}
		// Late responses cannot belong to a newer filter, even during rapid changes.
		this.sourceId = `${this.layer.id}-source-${++this.generation}`;
		this.setState('loading');
		this.map.addSource(this.sourceId, {
			type: 'vector',
			tiles: [`${this.protocol}://${url}`],
			minzoom: 6,
			maxzoom: 14,
		});
		this.map.addLayer(
			{
				...this.layer,
				source: this.sourceId,
				paint: {
					...this.layer.paint,
					'line-opacity': 0,
					'line-opacity-transition': { duration: 0 },
				},
			},
			this.map.getLayer(this.beforeLayer) ? this.beforeLayer : undefined,
		);
	}

	retry(): void {
		this.select(this.url, true);
	}

	destroy(): void {
		clearTimeout(this.deadline);
		this.map.off('render', this.checkComplete);
		this.map.off('sourcedataloading', this.onLoading);
		this.map.off('error', this.onError);
		this.map.off('movestart', this.onMove);
		removeProtocol(this.protocol);
	}

	private readonly checkComplete = (): void => {
		if (this.state !== 'loading' || !this.sourceId || this.map.isMoving()) return;
		// Metadata can finish before tiles are requested. Check after the render's source update.
		if (this.map.getSource(this.sourceId) && this.map.isSourceLoaded(this.sourceId))
			this.setState('ready');
	};

	private readonly onLoading = (event: MapSourceDataEvent): void => {
		if (event.sourceId === this.sourceId && this.state === 'ready') this.setState('loading');
	};

	private readonly onMove = (): void => {
		if (this.sourceId && this.state === 'ready') this.setState('loading');
	};

	private readonly onError = (event: ErrorEvent): void => {
		if (
			this.sourceId &&
			(event as ErrorEvent & { sourceId?: string }).sourceId === this.sourceId
		)
			this.setState('error');
	};

	private setState(state: FilteredMapState): void {
		this.state = state;
		clearTimeout(this.deadline);
		if (state === 'loading') this.deadline = setTimeout(() => this.setState('error'), 180_000);
		if (this.map.getLayer(this.layer.id))
			this.map.setPaintProperty(this.layer.id, 'line-opacity', state === 'ready' ? 0.88 : 0);
		this.onState(state);
	}

	private removeSource(): void {
		clearTimeout(this.deadline);
		const previousSource = this.sourceId;
		this.sourceId = undefined;
		if (this.map.getLayer(this.layer.id)) this.map.removeLayer(this.layer.id);
		if (previousSource && this.map.getSource(previousSource))
			this.map.removeSource(previousSource);
	}
}
