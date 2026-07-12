export type RoadClosureFactorType = 'CONSTRUCTION' | 'ROAD_CLOSURE' | 'EVENT' | 'HAZARD' | 'INCIDENT';

export type RoadClosureSeverity = 'NO_CLOSURE' | 'FULL_CLOSURE' | 'DIRECTIONAL_CLOSURE' | 'UNKNOWN';

/** One construction site / road closure from the VIZ Berlin feed. */
export interface RoadClosure {
	id: string;
	factorType: RoadClosureFactorType;
	severity: RoadClosureSeverity;
	direction?: string;
	street?: string;
	section?: string;
	content?: string;
	/** epoch millis */
	validFrom?: number;
	/** epoch millis; absent = open-ended */
	validTo?: number;
	/** label point */
	lon: number;
	lat: number;
	/** affected stretches as MultiLineString coordinates ([line][vertex][lon, lat]) */
	lines: number[][][];
}

export interface RoadClosuresParams {
	/** epoch millis */
	from?: number;
	/** epoch millis */
	to?: number;
}
