import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import https from 'https';

const uploadsDir = path.join(process.cwd(), 'uploads');
const sampleName = 'playwright-sample.pdf';
const samplePath = path.join(uploadsDir, sampleName);

async function ensureSamplePDF() {
  await fs.promises.mkdir(uploadsDir, { recursive: true });
  if (fs.existsSync(samplePath)) return;

  await new Promise<void>((resolve, reject) => {
    const fileStream = fs.createWriteStream(samplePath);
    https
      .get(
        'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        (res) => {
          res.pipe(fileStream);
          fileStream.on('finish', () => fileStream.close(() => resolve()));
          fileStream.on('error', reject);
        }
      )
      .on('error', reject);
  });
}

async function login(page: import('@playwright/test').Page) {
  // Hit the validate-token endpoint to set iron-session cookie
  const res = await page.request.post('/api/validate-token', {
    data: { token: 'dapi_fake_valid_token_1234567890123456' },
  });
  expect(res.ok()).toBeTruthy();
}

// Minimal VerificationReport structure for seeding
function buildReport(docName: string, docPath: string) {
  return {
    documentName: docName,
    documentPath: docPath,
    uploadDate: new Date().toISOString(),
    processingDate: new Date().toISOString(),
    results: [
      {
        itemId: 1,
        status: 'verified',
        evidence: {
          text: 'Dummy PDF evidence',
          tokens: [
            {
              startTokens: ['Dummy', 'PDF'],
              endTokens: ['PDF', 'file'],
              fullText: 'Dummy PDF file',
            },
          ],
        },
      },
    ],
    summary: { total: 1, passed: 1, failed: 0, successRate: 100 },
  };
}

test.describe('Report Viewer', () => {
  test.beforeAll(async () => {
    process.env.USE_REAL_API = 'false';
    await ensureSamplePDF();
  });

  test('loads and renders PDF with a seeded report', async ({ page }) => {
    await login(page);

    // Seed sessionStorage before navigation
    await page.addInitScript((report) => {
      sessionStorage.setItem('verificationReport', JSON.stringify(report));
    }, buildReport(sampleName, path.join(process.cwd(), 'uploads', sampleName)));

    await page.goto('/report-viewer');

    // Should show page controls and page count once loaded
    await expect(page.getByText(/Page \d+ of \d+/)).toBeVisible();

    // The react-pdf document/container appears
    await expect(page.locator('.react-pdf__Document')).toBeVisible();

    // Click the first checklist item and allow highlight recompute
    await page.getByText('Item 1').click();

    // We can at least verify the page number still visible and no error banners
    await expect(page.getByText(/Page \d+ of \d+/)).toBeVisible();
    await expect(page.getByText('Failed to load PDF', { exact: false })).toHaveCount(0);
  });

  test('shows a clear error when PDF is missing (404)', async ({ page }) => {
    await login(page);

    // Seed a report pointing to a non-existent file
    await page.addInitScript((report) => {
      sessionStorage.setItem('verificationReport', JSON.stringify(report));
    }, buildReport('non-existent.pdf', path.join(process.cwd(), 'uploads', 'non-existent.pdf')));

    await page.goto('/report-viewer');

    // Expect our error banner to show up
    await expect(page.getByText('Failed to load PDF', { exact: false })).toBeVisible();
  });
});

