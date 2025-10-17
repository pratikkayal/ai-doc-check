import { test, expect } from '@playwright/test';

// Helper: authenticate via token endpoint
async function login(page: import('@playwright/test').Page) {
  await page.request.post('/api/validate-token', { data: { token: 'dapi_fake_valid_token_1234567890123456' } });
}

test('edit checklist flow: navigate from dashboard, form prepopulates, save changes, dashboard reflects updates', async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);

  // 1) Create a checklist to edit
  await page.goto('/checklists/new');
  await page.getByLabel('Name').fill('Checklist To Edit');
  await page.locator('#description').fill('This will be edited');
  await page.getByLabel('Item description').fill('First item');
  await page.getByLabel('Criteria').fill('c1');
  await page.getByRole('button', { name: 'Save Checklist' }).click();

  // Redirects to dashboard
  await page.waitForURL('**/dashboard');

  // 2) Click Edit on the created checklist card
  await page.getByRole('button', { name: 'Edit checklist Checklist To Edit' }).first().click();

  // 3) Edit page pre-population
  await expect(page.getByRole('heading', { name: 'Edit Checklist' })).toBeVisible();
  await expect(page.getByLabel('Name')).toHaveValue('Checklist To Edit');
  await expect(page.locator('#description')).toHaveValue('This will be edited');
  await expect(page.getByLabel('Item description')).toHaveValue('First item');

  // 4) Make changes: rename and add another item
  await page.getByLabel('Name').fill('Checklist To Edit v2');
  await page.getByRole('button', { name: 'Add Item' }).click();
  await page.getByLabel('Item description').nth(1).fill('Second item');
  await page.getByLabel('Criteria').nth(1).fill('c2');

  // 5) Save changes
  await page.getByRole('button', { name: 'Save Changes' }).click();

  // Redirect back to dashboard
  await page.waitForURL('**/dashboard');

  // 6) Confirm updated name is visible, select it, and check items panel reflects 2 items
  await expect(page.getByRole('heading', { name: 'Checklist To Edit v2' }).first()).toBeVisible();
  await page.getByRole('button', { name: 'Select checklist Checklist To Edit v2' }).first().click();
  await expect(page.getByText(/2 items to verify/)).toBeVisible();
  await expect(page.getByText('First item')).toBeVisible();
  await expect(page.getByText('Second item')).toBeVisible();
});

