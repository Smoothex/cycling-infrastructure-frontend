import type { Map as MapLibreMap } from 'maplibre-gl';
import { FilteredMapLayer } from './filtered-map-layer';

describe('FilteredMapLayer', () => {
	let sources: Map<string, unknown>;
	let layers: Map<string, unknown>;
	let listeners: Map<string, (event?: unknown) => void>;
	let map: Record<string, jest.Mock>;
	let controller: FilteredMapLayer;
	let state: jest.Mock;
	const sourceId = () => [...sources.keys()][0];
	beforeEach(() => {
		jest.useFakeTimers();
		sources = new Map();
		layers = new Map();
		listeners = new Map();
		state = jest.fn();
		map = {
			on: jest.fn((name, fn) => listeners.set(name, fn)),
			off: jest.fn((name) => listeners.delete(name)),
			getSource: jest.fn((id) => sources.get(id)),
			getLayer: jest.fn((id) => layers.get(id)),
			addSource: jest.fn((id, source) => sources.set(id, source)),
			addLayer: jest.fn((layer) => layers.set(layer.id, layer)),
			removeSource: jest.fn((id) => sources.delete(id)),
			removeLayer: jest.fn((id) => layers.delete(id)),
			setPaintProperty: jest.fn(),
			isMoving: jest.fn(() => false),
			isSourceLoaded: jest.fn(() => false),
		};
		controller = new FilteredMapLayer(
			map as unknown as MapLibreMap,
			{ id: 'filtered', type: 'line', source: '', 'source-layer': 'segments' },
			'highlight',
			state,
		);
	});
	afterEach(() => {
		controller.destroy();
		jest.useRealTimers();
	});

	it('keeps partial tiles hidden and reveals the completed viewport together', () => {
		controller.select('filter-a');
		expect(map['addLayer'].mock.calls[0][0].paint['line-opacity']).toBe(0);
		listeners.get('render')?.();
		expect(state).toHaveBeenLastCalledWith('loading');
		map['isSourceLoaded'].mockReturnValue(true);
		listeners.get('render')?.();
		expect(state).toHaveBeenLastCalledWith('ready');
		expect(map['setPaintProperty']).toHaveBeenLastCalledWith('filtered', 'line-opacity', 0.88);
	});

	it('isolates rapid filter changes and ignores late errors from removed sources', () => {
		controller.select('filter-a');
		const old = sourceId();
		controller.select('filter-b');
		expect(sourceId()).not.toBe(old);
		expect(sources.size).toBe(1);
		listeners.get('error')?.({ sourceId: old });
		expect(state).toHaveBeenLastCalledWith('loading');
		controller.select('filter-b');
		expect(map['addSource']).toHaveBeenCalledTimes(2);
	});

	it('does not treat a failed tile as a complete result and retries using a fresh source', () => {
		controller.select('filter-a');
		const failed = sourceId();
		listeners.get('error')?.({ sourceId: failed });
		map['isSourceLoaded'].mockReturnValue(true);
		listeners.get('render')?.();
		expect(state).toHaveBeenLastCalledWith('error');
		controller.retry();
		expect(sourceId()).not.toBe(failed);
		expect(state).toHaveBeenLastCalledWith('loading');
		listeners.get('render')?.();
		expect(state).toHaveBeenLastCalledWith('ready');
	});

	it('hides the previous viewport during movement and waits for the new tiles', () => {
		controller.select('filter-a');
		map['isSourceLoaded'].mockReturnValue(true);
		listeners.get('render')?.();
		listeners.get('movestart')?.();
		expect(state).toHaveBeenLastCalledWith('loading');
		map['isMoving'].mockReturnValue(true);
		listeners.get('render')?.();
		expect(state).toHaveBeenLastCalledWith('loading');
		map['isMoving'].mockReturnValue(false);
		map['isSourceLoaded'].mockReturnValue(false);
		listeners.get('render')?.();
		expect(state).toHaveBeenLastCalledWith('loading');
		map['isSourceLoaded'].mockReturnValue(true);
		listeners.get('render')?.();
		expect(state).toHaveBeenLastCalledWith('ready');
	});

	it('reports stalled requests, but clearing filters cancels the deadline', () => {
		controller.select('filter-a');
		jest.advanceTimersByTime(180_000);
		expect(state).toHaveBeenLastCalledWith('error');
		controller.retry();
		controller.select(undefined);
		jest.advanceTimersByTime(180_000);
		expect(state).toHaveBeenLastCalledWith('idle');
		expect(sources.size).toBe(0);
		expect(layers.size).toBe(0);
	});

	it('recreates the same filter after a base-style replacement', () => {
		controller.select('filter-a');
		const old = sourceId();
		sources.clear();
		layers.clear();
		controller.select('filter-a');
		expect(sourceId()).not.toBe(old);
		expect(state).toHaveBeenLastCalledWith('loading');
	});

	it('cleans up timers and event listeners on destruction', () => {
		controller.select('filter-a');
		controller.destroy();
		state.mockClear();
		jest.advanceTimersByTime(180_000);
		expect(state).not.toHaveBeenCalled();
		expect(listeners.size).toBe(0);
	});
});
