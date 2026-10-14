import { chromium } from '@playwright/test';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
const base = process.env.VERIFY_ORIGIN || 'http://localhost:3000';
const credentials = readFileSync('data/operator-credentials.txt', 'utf8');
const username = credentials.match(/^Username: (.+)$/m)?.[1],
  password = credentials.match(/^Password: (.+)$/m)?.[1];
if (!username || !password)
  throw new Error('For this local QA helper, run admin:setup -- --generate first.');
const browser = await chromium.launch({
  channel: process.platform === 'win32' ? 'chrome' : undefined,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const errors = [],
  requests = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(m.text());
});
page.on('request', (req) => requests.push(req.url()));
mkdirSync('docs/qa', { recursive: true });
try {
  await page.goto(base);
  await page.getByRole('heading', { name: 'Meet your operating potential.' }).waitFor();
  await page.screenshot({ path: 'docs/qa/production-workspace-desktop.png' });
  const metrics = await page.evaluate(() => ({
    domNodes: document.querySelectorAll('*').length,
    scrollWidth: document.documentElement.scrollWidth,
    viewport: innerWidth,
    assets: performance
      .getEntriesByType('resource')
      .map((r) => ({ name: r.name.split('/').at(-1), bytes: r.transferSize })),
    navigation: performance.getEntriesByType('navigation')[0]?.toJSON(),
  }));
  await page.goto(base + '/protocol');
  await page.getByRole('heading', { name: 'The assessment battery' }).waitFor();
  await page.goto(base + '/admin');
  await page.getByLabel('Operator username').fill(username);
  await page.getByLabel('Operator password').fill(password);
  await page.getByRole('button', { name: 'Access console' }).click();
  await page.getByRole('heading', { name: 'Laboratory overview.' }).waitFor();
  await page.screenshot({ path: 'docs/qa/production-admin-desktop.png' });
  await page.getByRole('button', { name: 'Sessions', exact: true }).click();
  await page.getByRole('button', { name: 'Open session Demo subject' }).first().click();
  await page.getByRole('heading', { name: 'Demo subject', exact: true }).waitFor();
  await page.screenshot({ path: 'docs/qa/production-session-desktop.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: 'docs/qa/production-admin-mobile.png' });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    throw new Error('Mobile admin overflow');
  await page.goto(base);
  await page.screenshot({ path: 'docs/qa/production-workspace-mobile.png', fullPage: true });
  const start = await page.evaluate(async () => {
    const response = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cortex-request': '1' },
      body: JSON.stringify({
        alias: 'Production smoke subject',
        mode: 'custom',
        custom: { moduleIds: ['logic'], rounds: 1 },
      }),
    });
    return response.json();
  });
  await page.goto(base + '/assessment');
  await page.getByRole('button', { name: 'Enter module' }).click();
  await page.getByRole('button', { name: 'Start trial' }).click();
  await page.locator('.option').first().click();
  await page.getByRole('button', { name: 'Submit response' }).click();
  await page.locator('.score-reveal').waitFor();
  await page.screenshot({ path: 'docs/qa/production-results-mobile.png', fullPage: true });
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    throw new Error('Mobile results overflow');
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: 'docs/qa/production-results-desktop.png' });
  await page.getByRole('button', { name: 'Open final disclosure' }).click();
  await page.getByRole('heading', { name: 'You have been benchmarked.' }).waitFor();
  const external = requests.filter((url) => new URL(url).origin !== new URL(base).origin);
  if (external.length) throw new Error('Unexpected external runtime requests');
  if (errors.length) throw new Error(errors.join('\n'));
  const report = {
    origin: base,
    verifiedAt: new Date().toISOString(),
    pages: [
      'workspace',
      'protocol',
      'admin login',
      'admin dashboard',
      'session detail',
      'assessment',
      'results',
      'reveal',
    ],
    widths: [1440, 390],
    consoleErrors: errors,
    externalRequests: external,
    assessmentCompleted: !!start.id,
    metrics,
  };
  writeFileSync('docs/qa/production-verification.json', JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({
      status: 'passed',
      pages: report.pages,
      consoleErrors: errors.length,
      externalRequests: external.length,
      domNodes: metrics.domNodes,
      initialTransferBytes: metrics.assets.reduce((sum, r) => sum + r.bytes, 0),
    }),
  );
} finally {
  await browser.close();
}
