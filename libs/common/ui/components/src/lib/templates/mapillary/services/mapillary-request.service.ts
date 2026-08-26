import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, Observable, of, switchMap } from 'rxjs';

const defaultSearchRadiusMeters = 50;
const maximumResults = 2000;
const earthRadiusMeters = 6_371_000;

export type MapillaryTemporalMatch = 'IN_RANGE' | 'NEAREST_DATE';

export interface MapillaryImageMatch {
	id: string;
	coordinates: [number, number];
	capturedAt: string;
	temporalMatch: MapillaryTemporalMatch;
}

export interface MapillaryImageSearchOptions {
	radiusMeters?: number;
	from?: Date;
	to?: Date;
	fallbackToNearestDate?: boolean;
}

interface MapillaryPointGeometry {
	type: 'Point';
	coordinates: [number, number];
}

interface MapillaryImageResponseItem {
	id: string | number;
	captured_at: string | number;
	computed_geometry?: MapillaryPointGeometry;
	geometry?: MapillaryPointGeometry;
}

interface MapillaryImagesResponse {
	data?: MapillaryImageResponseItem[];
}

interface NormalizedMapillaryImage {
	id: string;
	coordinates: [number, number];
	capturedAt: Date;
	distanceMeters: number;
}

@Injectable({
	providedIn: 'root',
})
export class MapillaryRequestService {
	private readonly _httpClient = inject(HttpClient);

	findNearestImage(
		latitude: number,
		longitude: number,
		options: MapillaryImageSearchOptions = {},
	): Observable<MapillaryImageMatch | undefined> {
		const radiusMeters = options.radiusMeters ?? defaultSearchRadiusMeters;
		const from = options.from;
		const to = options.to;
		const hasTemporalRange = from !== undefined && to !== undefined;

		return this.requestImages(latitude, longitude, radiusMeters, from, to).pipe(
			switchMap((images) => {
				const nearestImage = this.selectSpatiallyNearest(images);
				if (nearestImage || !hasTemporalRange || !options.fallbackToNearestDate) {
					return of(this.toMatch(nearestImage, 'IN_RANGE'));
				}

				return this.requestImages(latitude, longitude, radiusMeters).pipe(
					map((fallbackImages) =>
						this.toMatch(
							this.selectTemporallyNearest(fallbackImages, from, to),
							'NEAREST_DATE',
						),
					),
				);
			}),
		);
	}

	private requestImages(
		latitude: number,
		longitude: number,
		radiusMeters: number,
		from?: Date,
		to?: Date,
	): Observable<NormalizedMapillaryImage[]> {
		const bbox = this.boundingBox(latitude, longitude, radiusMeters);
		let params = new HttpParams()
			.set('fields', 'id,captured_at,geometry,computed_geometry')
			.set('bbox', bbox.join(','))
			.set('limit', maximumResults);

		if (from) {
			params = params.set('start_captured_at', from.toISOString());
		}
		if (to) {
			params = params.set('end_captured_at', to.toISOString());
		}

		return this._httpClient
			.get<MapillaryImagesResponse>('/mapillary/images', { params })
			.pipe(
				map((response) =>
					(response.data ?? [])
						.map((image) => this.normalizeImage(image, latitude, longitude))
						.filter(
							(image): image is NormalizedMapillaryImage =>
								image !== undefined && image.distanceMeters <= radiusMeters,
						),
				),
			);
	}

	private normalizeImage(
		image: MapillaryImageResponseItem,
		latitude: number,
		longitude: number,
	): NormalizedMapillaryImage | undefined {
		const geometry = image.computed_geometry ?? image.geometry;
		const rawCapturedAt =
			typeof image.captured_at === 'string' && /^\d+$/.test(image.captured_at)
				? Number(image.captured_at)
				: image.captured_at;
		const capturedAt = new Date(rawCapturedAt);
		const [imageLongitude, imageLatitude] = geometry?.coordinates ?? [];
		if (
			!geometry ||
			!Number.isFinite(imageLongitude) ||
			!Number.isFinite(imageLatitude) ||
			Number.isNaN(capturedAt.getTime())
		) {
			return undefined;
		}

		return {
			id: String(image.id),
			coordinates: [imageLongitude, imageLatitude],
			capturedAt,
			distanceMeters: this.distanceMeters(
				latitude,
				longitude,
				imageLatitude,
				imageLongitude,
			),
		};
	}

	private selectSpatiallyNearest(
		images: NormalizedMapillaryImage[],
	): NormalizedMapillaryImage | undefined {
		return [...images].sort(
			(left, right) =>
				left.distanceMeters - right.distanceMeters ||
				right.capturedAt.getTime() - left.capturedAt.getTime(),
		)[0];
	}

	private selectTemporallyNearest(
		images: NormalizedMapillaryImage[],
		from: Date,
		to: Date,
	): NormalizedMapillaryImage | undefined {
		return [...images].sort((left, right) => {
			const temporalDifference =
				this.distanceFromRange(left.capturedAt, from, to) -
				this.distanceFromRange(right.capturedAt, from, to);
			return (
				temporalDifference ||
				left.distanceMeters - right.distanceMeters ||
				right.capturedAt.getTime() - left.capturedAt.getTime()
			);
		})[0];
	}

	private toMatch(
		image: NormalizedMapillaryImage | undefined,
		temporalMatch: MapillaryTemporalMatch,
	): MapillaryImageMatch | undefined {
		if (!image) {
			return undefined;
		}

		return {
			id: image.id,
			coordinates: image.coordinates,
			capturedAt: image.capturedAt.toISOString(),
			temporalMatch,
		};
	}

	private boundingBox(
		latitude: number,
		longitude: number,
		radiusMeters: number,
	): [number, number, number, number] {
		const latitudeDelta = (radiusMeters / earthRadiusMeters) * (180 / Math.PI);
		const longitudeDelta =
			(radiusMeters / (earthRadiusMeters * Math.cos((latitude * Math.PI) / 180))) *
			(180 / Math.PI);
		return [
			longitude - longitudeDelta,
			latitude - latitudeDelta,
			longitude + longitudeDelta,
			latitude + latitudeDelta,
		];
	}

	private distanceMeters(
		fromLatitude: number,
		fromLongitude: number,
		toLatitude: number,
		toLongitude: number,
	): number {
		const latitudeDelta = ((toLatitude - fromLatitude) * Math.PI) / 180;
		const longitudeDelta = ((toLongitude - fromLongitude) * Math.PI) / 180;
		const fromLatitudeRadians = (fromLatitude * Math.PI) / 180;
		const toLatitudeRadians = (toLatitude * Math.PI) / 180;
		const haversine =
			Math.sin(latitudeDelta / 2) ** 2 +
			Math.cos(fromLatitudeRadians) *
				Math.cos(toLatitudeRadians) *
				Math.sin(longitudeDelta / 2) ** 2;
		return 2 * earthRadiusMeters * Math.asin(Math.sqrt(haversine));
	}

	private distanceFromRange(value: Date, from: Date, to: Date): number {
		const timestamp = value.getTime();
		if (timestamp < from.getTime()) {
			return from.getTime() - timestamp;
		}
		if (timestamp > to.getTime()) {
			return timestamp - to.getTime();
		}
		return 0;
	}
}
