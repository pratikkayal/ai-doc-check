import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import https from 'https';

const fixturesDir = path.join(process.cwd(), 'tests', 'fixtures');
const fixturePdf = path.join(fixturesDir, 'dummy.pdf');

async function ensureFixturePDF() {
  await fs.promises.mkdir(fixturesDir, { recursive: true });
  if (fs.existsSync(fixturePdf)) return;

  await new Promise<void>((resolve, reject) => {
    const fileStream = fs.createWriteStream(fixturePdf);
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
  const res = await page.request.post('/api/validate-token', {
    data: { token: 'dapi_fake_valid_token_1234567890123456' },
  });
  expect(res.ok()).toBeTruthy();
}

test.describe('Full Flow: upload → processing → report → interactive viewer', () => {
  test.beforeAll(async () => {
    process.env.USE_REAL_API = 'false';
    await ensureFixturePDF();
  });

  test('end-to-end happy path', async ({ page }, testInfo) => {
    test.setTimeout(180_000);

    // Capture console and network for debugging PDF load
    const logs: string[] = [];
    page.on('console', (msg) => {
      const line = `[browser:${msg.type()}] ${msg.text()}`;
      logs.push(line);
      // eslint-disable-next-line no-console
      console.log(line);
    });
    page.on('response', async (res) => {
      if (res.url().includes('/api/serve-pdf')) {
        const line = `[network] ${res.status()} ${res.url()}`;
        logs.push(line);
        // eslint-disable-next-line no-console
        console.log(line);
      }
    });
    page.on('requestfailed', (req) => {
      const line = `[requestfailed] ${req.failure()?.errorText} ${req.url()}`;
      logs.push(line);
      // eslint-disable-next-line no-console
      console.log(line);
    });

    // Authenticate (iron-session cookie)
    await login(page);

    // Go to dashboard and wait for checklist load
    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Document Verification' })).toBeVisible();
    await expect(page.getByText('Verification Checklist')).toBeVisible();

    // Upload file via hidden input from react-dropzone
    const input = page.locator('input[type="file"]');
    await input.setInputFiles(fixturePdf);

    // Click Process Document
    const processBtn = page.getByRole('button', { name: 'Process Document' });
    await expect(processBtn).toBeVisible();
    await processBtn.click();

    // Land on processing page and wait for redirect to report
    await expect(page).toHaveURL(/\/processing\?/);
    await expect(page.getByText('Processing Document')).toBeVisible();

    // Wait until report page appears (the SSE completes and router navigates)
    await expect(page).toHaveURL('/report', { timeout: 120_000 });
    await expect(page.getByRole('heading', { name: 'Verification Report' })).toBeVisible();

    // Navigate to viewer
    await page.getByRole('button', { name: 'Interactive View' }).click();
    await expect(page).toHaveURL('/report-viewer');

    // Deep PDF-render assertions
    try {
      // Page controls should appear
      await expect(page.getByText(/Page \d+ of \d+/)).toBeVisible({ timeout: 60_000 });

      // "Loading PDF..." should disappear
      await expect(page.getByText('Loading PDF...')).toHaveCount(0);

      // No error banners
      await expect(page.getByText('Failed to load PDF', { exact: false })).toHaveCount(0);
      await expect(page.getByText('PDF file not found', { exact: false })).toHaveCount(0);

      // The react-pdf Document and an actual canvas should be visible and sized
      const canvas = page.locator('.react-pdf__Page__canvas').first();
      await expect(canvas).toBeVisible({ timeout: 60_000 });
      const sizeOk = await canvas.evaluate((el) => {
        const c = el as HTMLCanvasElement;
        const r = el.getBoundingClientRect();
        return (c.width || r.width) > 0 && (c.height || r.height) > 0;
      });
      expect(sizeOk).toBeTruthy();

      // Worker should be configured and PDF loaded according to console logs
      expect(logs.some(l => l.includes('PDF loaded:'))).toBeTruthy();
      expect(logs.some(l => l.includes('Failed to configure PDF.js worker'))).toBeFalsy();
      expect(logs.some(l => l.includes('PDF load error'))).toBeFalsy();
    } catch (err) {
      // Attach a screenshot and some DOM state for easier debugging
      const shot = await page.screenshot({ fullPage: true });
      await testInfo.attach('pdf-failure-screenshot', { body: shot, contentType: 'image/png' });
      const controls = await page.locator('text=/Page \\d+ of \\d+/').count();
      const canvasCount = await page.locator('.react-pdf__Page__canvas').count();
      // eslint-disable-next-line no-console
      console.log(`[debug] controls=${controls} canvasCount=${canvasCount}`);
      throw err;
    }
  });

  test('stale filename fallback resolves and renders', async ({ page }, testInfo) => {
    test.setTimeout(180_000);

    const logs: string[] = [];
    page.on('console', (msg) => logs.push(`[browser:${msg.type()}] ${msg.text()}`));
    let servePdfHeader: Record<string, string> | null = null;
    page.on('response', async (res) => {
      if (res.url().includes('/api/serve-pdf')) {
        servePdfHeader = await res.headers();
      }
    });

    await login(page);
    await page.goto('/dashboard');
    await page.locator('input[type="file"]').setInputFiles(fixturePdf);
    await page.getByRole('button', { name: 'Process Document' }).click();
    await expect(page).toHaveURL('/report', { timeout: 120_000 });

    // Read the displayed documentName from the report header
    const docName = await page.getByText(/Verification Report/).locator('..').locator('..').locator('p').first().textContent();
    const original = (docName || '').trim();
    const dash = original.indexOf('-');
    expect(dash).toBeGreaterThan(0);
    const suffix = original.slice(dash + 1);

    // Craft a stale name with wrong timestamp but same suffix
    const stale = `12345-${suffix}`;

    // Build a minimal report for the viewer using the stale name
    const viewerReport = {
      documentName: stale,
      documentPath: `/uploads/${stale}`,
      uploadDate: new Date().toISOString(),
      processingDate: new Date().toISOString(),
      results: [
        { itemId: 1, status: 'verified', evidence: { text: 'Dummy PDF evidence', tokens: [] } },
      ],
      summary: { total: 1, passed: 1, failed: 0, successRate: 100 },
    };

    // Seed sessionStorage with our crafted report and go to viewer directly
    await page.addInitScript((report) => sessionStorage.setItem('verificationReport', JSON.stringify(report)), viewerReport);
    await page.goto('/report-viewer');

    // Expect fallback to resolve a different filename via header
    await page.waitForTimeout(1000); // give the HEAD/GET a moment
    expect(servePdfHeader && ('x-resolved-filename' in servePdfHeader)).toBeTruthy();
    const resolved = servePdfHeader ? servePdfHeader['x-resolved-filename'] : '';
    expect(resolved).toBeTruthy();
    expect(resolved).not.toEqual(stale);
    expect(resolved.endsWith(suffix)).toBeTruthy();

    // PDF renders fully
    await expect(page.getByText(/Page \d+ of \d+/)).toBeVisible({ timeout: 60_000 });
    await expect(page.getByText('Loading PDF...')).toHaveCount(0);
    await expect(page.getByText('Failed to load PDF', { exact: false })).toHaveCount(0);
    await expect(page.locator('.react-pdf__Page__canvas').first()).toBeVisible({ timeout: 60_000 });
  });

  test('invalid filename shows error and not stuck', async ({ page }) => {
    test.setTimeout(120_000);

    await login(page);
    await page.goto('/report');

    const viewerReport = {
      documentName: '9999-no-such-file-anywhere.pdf',
      documentPath: '/uploads/9999-no-such-file-anywhere.pdf',
      uploadDate: new Date().toISOString(),
      processingDate: new Date().toISOString(),
      results: [ { itemId: 1, status: 'verified', evidence: { text: 'n/a', tokens: [] } } ],
      summary: { total: 1, passed: 0, failed: 1, successRate: 0 },
    };

    await page.addInitScript((report) => sessionStorage.setItem('verificationReport', JSON.stringify(report)), viewerReport);
    await page.goto('/report-viewer');

    // Should transition to error banner; not remain in Loading state forever
    await expect(page.getByText('Failed to load PDF', { exact: false })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Loading PDF...')).toHaveCount(0);
    await expect(page.locator('.react-pdf__Page__canvas')).toHaveCount(0);
  });
});

