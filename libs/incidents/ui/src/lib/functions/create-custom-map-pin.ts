import * as maplibregl from 'maplibre-gl';

export function createCustomMapMarker(isScary: boolean): maplibregl.Marker {
    const svgUrl = `assets/icons/incidents/ui/pin-${isScary ? 'red': 'blue'}.svg`;
	
    const el = document.createElement('div');
    el.className = 'text-4xl';
    el.innerHTML = `<img src="${svgUrl}" class="w-8 h-8" />`;

    return new maplibregl.Marker({
        element: el,
        anchor: 'bottom'
    });
}