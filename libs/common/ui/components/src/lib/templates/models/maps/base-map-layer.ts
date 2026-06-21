export const BASE_MAP_LAYER_SOURCES: Record<string, any> = {
    OSM_DEFAULT: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.de/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '&copy; OpenStreetMap contributors'
    },
    GOOGLE: {
        type: 'raster',
        tiles: [
            'https://mt0.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
            'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}'
        ],
        tileSize: 256
    }
};