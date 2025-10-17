import { test, expect } from '@playwright/test';

// Helper: authenticate via token endpoint
async function login(page: import('@playwright/test').Page) {
  await page.request.post('/api/validate-token', { data: { token: 'dapi_fake_valid_token_1234567890123456' } });
}

// Creates a new checklist via UI and ensures it appears on the dashboard selection and items render
test('create checklist -> select on dashboard -> items render', async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);

  // Create new checklist
  await page.goto('/checklists/new');
  await page.getByLabel('Name').fill('Playwright QA Checklist');
  await page.locator('#description').fill('Test checklist created by E2E');

  await page.getByLabel('Item description').first().fill('First Requirement');
  await page.getByLabel('Criteria').first().fill('Must satisfy condition A');

  await page.getByRole('button', { name: 'Add Item' }).click();
  const rows = page.locator('label:text("Item description")');
  await expect(rows).toHaveCount(2);

  // Fill second row
  await page.getByLabel('Item description').nth(1).fill('Second Requirement');
  await page.getByLabel('Criteria').nth(1).fill('Must satisfy condition B');

  await page.getByRole('button', { name: 'Save Checklist' }).click();

  // Redirects to dashboard
  await page.waitForURL('**/dashboard');

  // Select the newly created checklist using the card grid
  await page.getByRole('button', { name: 'Select checklist Playwright QA Checklist' }).first().click();

  // Expect the checklist panel to show 2 items
  await expect(page.getByText(/2 items to verify/)).toBeVisible();
  await expect(page.getByText('First Requirement')).toBeVisible();
  await expect(page.getByText('Second Requirement')).toBeVisible();
});

