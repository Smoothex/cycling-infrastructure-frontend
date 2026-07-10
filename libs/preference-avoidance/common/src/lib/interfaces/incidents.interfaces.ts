export type NearMissIncidentType =
	| 'NOTHING'
	| 'CLOSE_PASS'
	| 'PULLING_IN_OUT'
	| 'NEAR_HOOK'
	| 'HEAD_ON'
	| 'TAILGATING'
	| 'NEAR_DOORING'
	| 'DODGING'
	| 'OTHER'
	| 'DUMMY';

export type NearMissParticipantType =
	| 'BUS'
	| 'CYCLIST'
	| 'PEDESTRIAN'
	| 'DELIVERY_VAN'
	| 'TRUCK'
	| 'MOTORCYCLE'
	| 'CAR'
	| 'TAXI'
	| 'OTHER'
	| 'SCOOTER';

/** One near-miss (scary) incident point reported in a SimRa ride. */
export interface NearMissIncident {
	id: string;
	lon: number;
	lat: number;
	/** epoch millis */
	timestamp?: number;
	incidentType?: NearMissIncidentType;
	scary: boolean;
	description?: string;
	involvedParticipants: NearMissParticipantType[];
}

export interface NearMissIncidentsParams {
	/** epoch millis */
	from?: number;
	/** epoch millis */
	to?: number;
}
