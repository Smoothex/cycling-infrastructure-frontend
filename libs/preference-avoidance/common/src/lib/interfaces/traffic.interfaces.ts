/** One Berlin traffic detector (lane-level) from the Stammdaten import. */
export interface TrafficDetector {
	detName: string;
	detNameNeu?: string;
	mqName?: string;
	street?: string;
	position?: string;
	positionDetail?: string;
	direction?: string;
	lane?: string;
	/** ISO date */
	activeFrom?: string;
	/** ISO date */
	activeTo?: string;
	deinstalled: boolean;
	lon: number;
	lat: number;
}

export interface TrafficDetectorsResponse {
	/** segments within this distance of a detector can receive its measurements */
	matchRadiusMeters: number;
	detectors: TrafficDetector[];
}
