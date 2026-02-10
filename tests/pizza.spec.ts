import { test, expect } from 'playwright-test-coverage';

test('home page', async ({ page }) => {
  await page.goto('http://localhost:5173');

  expect(await page.title()).toBe('JWT Pizza');
});