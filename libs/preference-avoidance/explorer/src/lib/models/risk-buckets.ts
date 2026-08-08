import type { RiskBucket } from '@simra/preference-avoidance-common';

export type RiskLegendBucket = Exclude<RiskBucket, 'NO_EVENTS'>;

// Shared risk-bucket presentation and frontend classification used by map tile
// rendering, matched-segment overlays, highlights, filters, and the legend.
export const RISK_BUCKET_COLORS: Record<RiskBucket, string> = {
	PREFERENCE_EXTREME: '#166534',
	PREFERENCE_STRONG: '#15803d',
	PREFERENCE: '#16a34a',
	PREFERENCE_LIGHT: '#86efac',
	BASELINE: '#6b7280',
	AVOIDANCE_LIGHT: '#fca5a5',
	AVOIDANCE: '#dc2626',
	AVOIDANCE_STRONG: '#b91c1c',
	AVOIDANCE_EXTREME: '#991b1b',
	NO_EVENTS: '#d1d5db',
};

export const RISK_LEGEND_ITEMS = [
	{
		bucket: 'PREFERENCE_EXTREME',
		label: 'Extremely preferred segments',
		color: RISK_BUCKET_COLORS.PREFERENCE_EXTREME,
	},
	{
		bucket: 'PREFERENCE_STRONG',
		label: 'Strongly preferred segments',
		color: RISK_BUCKET_COLORS.PREFERENCE_STRONG,
	},
	{ bucket: 'PREFERENCE', label: 'Preferred segments', color: RISK_BUCKET_COLORS.PREFERENCE },
	{
		bucket: 'PREFERENCE_LIGHT',
		label: 'Slightly preferred segments',
		color: RISK_BUCKET_COLORS.PREFERENCE_LIGHT,
	},
	{ bucket: 'BASELINE', label: 'Balanced segments', color: RISK_BUCKET_COLORS.BASELINE },
	{
		bucket: 'AVOIDANCE_LIGHT',
		label: 'Slightly avoided segments',
		color: RISK_BUCKET_COLORS.AVOIDANCE_LIGHT,
	},
	{ bucket: 'AVOIDANCE', label: 'Avoided segments', color: RISK_BUCKET_COLORS.AVOIDANCE },
	{
		bucket: 'AVOIDANCE_STRONG',
		label: 'Strongly avoided segments',
		color: RISK_BUCKET_COLORS.AVOIDANCE_STRONG,
	},
	{
		bucket: 'AVOIDANCE_EXTREME',
		label: 'Extremely avoided segments',
		color: RISK_BUCKET_COLORS.AVOIDANCE_EXTREME,
	},
] as const satisfies readonly { bucket: RiskLegendBucket; label: string; color: string }[];

/**
 * Mirrors the backend balance expression by adding five neutral prior events.
 */
export function calculateEventBalance(avoidanceCount: number, preferenceCount: number): number {
	const eventCount = avoidanceCount + preferenceCount;
	if (eventCount === 0) {
		return 0;
	}

	return (preferenceCount - avoidanceCount) / (eventCount + 5);
}

export function classifyRiskBucket(balance: number, eventCount: number): RiskBucket {
	if (eventCount === 0) {
		return 'NO_EVENTS';
	}
	if (balance <= -0.9) {
		return 'AVOIDANCE_EXTREME';
	}
	if (balance <= -0.6) {
		return 'AVOIDANCE_STRONG';
	}
	if (balance <= -0.3) {
		return 'AVOIDANCE';
	}
	if (balance <= -0.1) {
		return 'AVOIDANCE_LIGHT';
	}
	if (balance >= 0.9) {
		return 'PREFERENCE_EXTREME';
	}
	if (balance >= 0.6) {
		return 'PREFERENCE_STRONG';
	}
	if (balance >= 0.3) {
		return 'PREFERENCE';
	}
	if (balance >= 0.1) {
		return 'PREFERENCE_LIGHT';
	}

	return 'BASELINE';
}
