import { calculateEventBalance, classifyRiskBucket, RISK_LEGEND_ITEMS } from './risk-buckets';

describe('risk buckets', () => {
	it('classifies zero events as NO_EVENTS', () => {
		expect(classifyRiskBucket(calculateEventBalance(0, 0), 0)).toBe('NO_EVENTS');
	});

	it('classifies balanced event counts as BASELINE', () => {
		expect(classifyRiskBucket(calculateEventBalance(12, 12), 24)).toBe('BASELINE');
	});

	it.each([
		[-0.1, 'AVOIDANCE_LIGHT'],
		[-0.3, 'AVOIDANCE'],
		[-0.6, 'AVOIDANCE_STRONG'],
		[-0.9, 'AVOIDANCE_EXTREME'],
		[0.1, 'PREFERENCE_LIGHT'],
		[0.3, 'PREFERENCE'],
		[0.6, 'PREFERENCE_STRONG'],
		[0.9, 'PREFERENCE_EXTREME'],
	] as const)('classifies a balance of %s as %s', (balance, expectedBucket) => {
		expect(classifyRiskBucket(balance, 1)).toBe(expectedBucket);
	});

	it('applies an additive five-event neutral prior', () => {
		expect(calculateEventBalance(0, 5)).toBe(0.5);
		expect(calculateEventBalance(5, 0)).toBe(-0.5);
		expect(classifyRiskBucket(calculateEventBalance(0, 1), 1)).toBe('PREFERENCE_LIGHT');
	});

	it('orders legend buckets from most preferred to most avoided and excludes NO_EVENTS', () => {
		expect(RISK_LEGEND_ITEMS.map(({ bucket }) => bucket)).toEqual([
			'PREFERENCE_EXTREME',
			'PREFERENCE_STRONG',
			'PREFERENCE',
			'PREFERENCE_LIGHT',
			'BASELINE',
			'AVOIDANCE_LIGHT',
			'AVOIDANCE',
			'AVOIDANCE_STRONG',
			'AVOIDANCE_EXTREME',
		]);
	});
});
