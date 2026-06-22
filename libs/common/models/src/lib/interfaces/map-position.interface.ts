import { CoordinateInterface } from './coordinate.interface';

export interface IMapPosition extends CoordinateInterface {
	/**
	 * Zoom level of the leaflet map
	 */
	zoom: number;

	/**
	 * ID of the street
	 */
	osm_id?: number;

	/**
	 * Indicates if a jump or fly is performed
	 */
	isNavigated?: boolean;

	/*
	 * Whether to move to the position or not
	*/
	moveTo?: boolean;
}
