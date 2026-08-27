import { test, expect } from '@playwright/test';

const issueKey = process.env.JIRA_TEST_ISSUE_KEY;

test.describe('System Alert Manager deployed UI', () => {
  test.beforeEach(async ({ page }) => {
    if (!process.env.JIRA_BASE_URL) throw new Error('JIRA_BASE_URL is not set');
    if (!issueKey) throw new Error('JIRA_TEST_ISSUE_KEY is not set');

    await page.goto(`/browse/${issueKey}`, { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`/browse/${issueKey}`));
  });

  test('Jira issue loads with authenticated test session', async ({ page }) => {
    await expect(page.locator('body')).not.toContainText(/log in to continue|sign in to continue/i);
    await expect(page.locator('body')).toContainText(issueKey);
  });

  test('System Alert UI is present on an eligible issue', async ({ page }) => {
    const body = page.locator('body');
    await expect(body).toContainText(/System Alert|Send System Alert/i);
  });
});
