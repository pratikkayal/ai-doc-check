import { test, expect } from '@playwright/test';

// Helper: authenticate via token endpoint (same as other checklist tests)
async function login(page: import('@playwright/test').Page) {
  await page.request.post('/api/validate-token', { data: { token: 'dapi_fake_valid_token_1234567890123456' } });
}

// E2E: AI-generated checklist flow
// Uses simulated API mode when USE_REAL_API !== 'true'

test('AI generation -> review/edit -> save -> visible on dashboard', async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  // Visit dashboard first to ensure session is initialized
  await page.goto('/dashboard');
  await expect(page.getByRole('heading', { name: 'Document Verification' })).toBeVisible();

  // Navigate to Generate with AI page
  await page.goto('/checklists/generate');
  await expect(page).toHaveURL(/\/checklists\/generate$/);

  // Fill inputs
  await page.fill('input[placeholder="e.g., Resume, Contract, Invoice"]', 'Invoice');
  await page.fill('textarea[placeholder="Add context or specific requirements for the checklist"]', 'Focus on billing accuracy and compliance.');
  await page.fill('input[type="number"]', '5');

  // Generate
  await page.getByRole('button', { name: 'Generate' }).click();

  // Wait for review section to appear
  await expect(page.getByText('Review & Edit')).toBeVisible();

  // Ensure items rendered
  const itemInputs = page.locator('input[placeholder="Description"]');
  await expect(itemInputs.first()).toBeVisible();

  // Edit first item
  await itemInputs.first().click();
  await itemInputs.first().type(' (edited)');

  // Save checklist
  await page.getByRole('button', { name: 'Save Checklist' }).click();

  // Should navigate back to dashboard
  await page.waitForURL('**/dashboard');

  // Verify the new checklist appears by name (card grid select button)
  await expect(page.getByRole('button', { name: 'Select checklist Invoice Checklist (AI)' }).first()).toBeVisible();
});

