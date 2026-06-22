import { test, expect } from '@playwright/test';

test('has title', async ({ page }) => {
	await page.goto('/');

	// Expect h1 to contain a substring.
	const intersectionsMapLink = page.locator('a[href="/intersections/map"]');
    expect(await intersectionsMapLink.innerText()).toContain('Map');
});
