import { test, expect, type Page } from '@playwright/test';
import { generate } from '../../server/generators';
import { translate } from '../../shared/localization';
async function request(page: Page, path: string, method = 'GET', body?: any) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const r = await fetch('/api' + path, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-cortex-request': '1' },
        body: body ? JSON.stringify(body) : undefined,
      });
      return r.json();
    },
    { path, method, body },
  );
}
test('Ukrainian preparation, session creation and disclosure work through the UI', async ({
  page,
}) => {
  const t = (value: string) => translate(value, 'uk');
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await page.getByLabel('Language', { exact: true }).selectOption('uk');
  await page.getByRole('button', { name: t('Configure a custom battery') }).click();
  const boxes = page.locator('.custom-panel input[type=checkbox]');
  for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).uncheck();
  await page.getByLabel(t('Logical reasoning'), { exact: true }).check();
  await page.getByLabel(t('Trials per dimension')).fill('1');
  await page.getByRole('button', { name: t('Prepare assessment') }).click();
  await expect(page.locator('.protocol-note')).toContainText('Мідь');
  await page.getByLabel(t('I understand and want to participate.')).check();
  await page.getByRole('button', { name: t('Continue'), exact: true }).click();
  await page.getByRole('button', { name: t('Test input'), exact: true }).click();
  await page.getByRole('button', { name: t('Calibrate timing') }).click();
  await expect(page.getByRole('button', { name: /Діапазон планування/ })).toBeVisible();
  await page.getByRole('button', { name: t('Continue'), exact: true }).click();
  await page.getByRole('button', { name: t('Continue'), exact: true }).click();
  await page.getByLabel(t('Participant alias'), { exact: true }).fill('Українська перевірка');
  await page.getByRole('button', { name: t('Begin assessment') }).click();
  const session = await request(page, '/session');
  expect(session.locale).toBe('uk');
  await page.getByRole('button', { name: t('Enter module') }).click();
  await page.getByRole('button', { name: t('Start trial →') }).click();
  const { answer } = generate(session.seed, session.plan, 0, 2, 'uk');
  await page.locator('.option').nth(answer).click();
  await page.getByRole('button', { name: t('Submit response →') }).click();
  await expect(page.locator('.score-reveal')).toBeVisible();
  await page.getByRole('button', { name: t('Open final disclosure') }).click();
  await expect(page.getByRole('heading', { name: t('You have been benchmarked.') })).toBeVisible();
  expect(errors).toEqual([]);
});

test('operator prepares profile and invite, participant resumes, result changes, release and reveal work', async ({
  browser,
}) => {
  const operator = await browser.newContext(),
    subject = await browser.newContext();
  const admin = await operator.newPage(),
    participant = await subject.newPage();
  const errors: string[] = [];
  for (const p of [admin, participant]) p.on('pageerror', (e) => errors.push(e.message));
  await admin.goto('/admin');
  await admin.getByLabel('Operator username').fill('e2e-operator');
  await admin.getByLabel('Operator password').fill('e2e-only-password');
  await admin.getByRole('button', { name: 'Access console' }).click();
  await expect(admin.getByRole('heading', { name: 'Laboratory overview.' })).toBeVisible();
  await admin.getByRole('button', { name: 'Result Profiles', exact: true }).click();
  await admin.getByRole('button', { name: 'Create profile +' }).click();
  const profileName = `E2E Disaster ${Date.now()}`;
  await admin.getByLabel('Profile name').fill(profileName);
  await admin.getByLabel('Load preset').selectOption('Absolute Disaster');
  await admin.getByLabel('index', { exact: true }).fill('7');
  await admin.getByRole('button', { name: 'Save configuration' }).click();
  await expect(admin.getByText(profileName, { exact: true })).toBeVisible();
  await admin.getByRole('button', { name: 'Invite Links', exact: true }).click();
  await admin
    .getByRole('combobox', { name: 'Result profile', exact: true })
    .selectOption({ label: profileName });
  await admin.getByRole('button', { name: 'Generate unique invite' }).click();
  const invite = await admin.getByLabel('Friend’s invite URL').inputValue();
  await participant.goto(invite);
  await participant.getByRole('button', { name: 'Configure a custom battery' }).click();
  const boxes = participant.locator('.custom-panel input[type=checkbox]');
  for (let i = 0; i < (await boxes.count()); i++) await boxes.nth(i).uncheck();
  await participant.getByLabel('Logical reasoning', { exact: true }).check();
  await participant.getByLabel('Trials per dimension').fill('2');
  await participant.getByRole('button', { name: 'Prepare assessment' }).click();
  await participant.getByLabel('I understand and want to participate.').check();
  await participant.getByRole('button', { name: 'Continue', exact: true }).click();
  await participant.getByRole('button', { name: 'Test input', exact: true }).click();
  await participant.getByRole('button', { name: 'Calibrate timing' }).click();
  await expect(participant.getByRole('button', { name: /ms scheduling range/ })).toBeVisible();
  await participant.getByRole('button', { name: 'Continue', exact: true }).click();
  await participant.getByRole('button', { name: 'Continue', exact: true }).click();
  const alias = `E2E Subject ${Date.now()}`;
  await participant.getByRole('textbox', { name: 'Participant alias', exact: true }).fill(alias);
  await participant.getByRole('button', { name: 'Begin assessment' }).click();
  await expect(
    participant.getByRole('heading', { name: 'Logical reasoning', exact: true }).first(),
  ).toBeVisible();
  await participant.getByRole('button', { name: 'Pause session' }).click();
  await participant.reload();
  await expect(participant.getByRole('heading', { name: 'Session paused.' })).toBeVisible();
  await participant.getByRole('button', { name: 'Resume assessment' }).click();
  await participant.getByRole('button', { name: 'Enter module' }).click();
  const session = await request(participant, '/session');
  for (let index = 0; index < 2; index++) {
    await participant.getByRole('button', { name: 'Start trial' }).click();
    const expected = generate(session.seed, session.plan, index, 2).answer;
    await participant.locator('.option').nth(expected).click();
    await participant.getByRole('button', { name: 'Submit response' }).click();
  }
  await expect(
    participant.getByRole('heading', { name: 'Final consistency analysis.' }),
  ).toBeVisible();
  expect(JSON.stringify(await request(participant, '/session/results'))).not.toContain('Hardware');
  await admin.getByRole('button', { name: 'Sessions', exact: true }).click();
  await admin.getByLabel('Search alias').fill(alias);
  await admin.getByRole('button', { name: `Open session ${alias}` }).click();
  await admin.getByRole('button', { name: 'Configure displayed result' }).click();
  await admin.getByLabel('index', { exact: true }).fill('13');
  await admin.getByRole('button', { name: 'Save configuration' }).click();
  await admin.getByRole('button', { name: 'Release results', exact: true }).click();
  await expect(participant.locator('.score-reveal')).toContainText('13', { timeout: 12000 });
  await admin.getByRole('button', { name: 'Trigger prank reveal', exact: true }).click();
  await expect(participant.getByRole('button', { name: 'Open final disclosure' })).toBeVisible({
    timeout: 12000,
  });
  await participant.getByRole('button', { name: 'Open final disclosure' }).click();
  await expect(
    participant.getByRole('heading', { name: 'You have been benchmarked.' }),
  ).toBeVisible();
  const revealed = await request(participant, '/session/results');
  await expect(participant.locator('.comparison-score').first()).toHaveText(
    `${revealed.real.index} / 1000`,
  );
  await expect(participant.locator('.comparison-score').nth(1)).toContainText('13');
  await participant.screenshot({ path: 'test-results/reveal-desktop.png', fullPage: true });
  await participant.setViewportSize({ width: 390, height: 844 });
  await participant.screenshot({ path: 'test-results/reveal-mobile.png', fullPage: true });
  expect(
    await participant.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
  ).toBe(true);
  expect(errors).toEqual([]);
  await operator.close();
  await subject.close();
});
test('memory, reaction, spatial, typing and interval instruments accept real browser inputs', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const session = await request(page, '/sessions', 'POST', {
    alias: 'Instrument QA',
    mode: 'custom',
    custom: {
      moduleIds: ['visual-memory', 'reaction', 'spatial', 'typing', 'temporal'],
      rounds: 1,
    },
  });
  await page.goto('/assessment');
  await page.getByRole('button', { name: 'Enter module' }).click();
  await page.getByRole('button', { name: 'Start trial' }).click();
  const grid = generate(session.seed, session.plan, 0, 2).challenge;
  await expect(page.getByRole('button', { name: 'Cell 1', exact: true })).toBeEnabled({
    timeout: 10000,
  });
  for (const index of grid.data.cells)
    await page.getByRole('button', { name: `Cell ${index + 1}`, exact: true }).click();
  await page.getByRole('button', { name: 'Submit response' }).click();
  await page.getByRole('button', { name: 'Enter module' }).click();
  await page.getByRole('button', { name: 'Start trial' }).click();
  await expect(page.getByText('Respond now', { exact: true })).toBeVisible({ timeout: 10000 });
  await page.keyboard.press('Space');
  await page.getByRole('button', { name: 'Enter module' }).click();
  await page.getByRole('button', { name: 'Start trial' }).click();
  const angle = generate(session.seed, session.plan, 2, 2).answer;
  await page.getByRole('button', { name: `${angle * 90}°`, exact: true }).click();
  await page.getByRole('button', { name: 'Submit response' }).click();
  await page.getByRole('button', { name: 'Enter module' }).click();
  await page.getByRole('button', { name: 'Start trial' }).click();
  await page
    .getByLabel('Transcription')
    .fill(generate(session.seed, session.plan, 3, 2).challenge.data.passage);
  await page.getByRole('button', { name: 'Submit response' }).click();
  await page.getByRole('button', { name: 'Enter module' }).click();
  await page.getByRole('button', { name: 'Start trial' }).click();
  await page.getByRole('button', { name: 'Start interval' }).click();
  await page.waitForTimeout(2100);
  await page.getByRole('button', { name: 'Stop interval' }).click();
  await expect(page.locator('.score-reveal')).toBeVisible();
  expect((await request(page, '/session/results')).real.categories['visual-memory']).toBe(100);
  expect(errors).toEqual([]);
});
test('desktop, tablet, mobile workspace and admin have no overflow or browser errors', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  for (const width of [1440, 768, 390]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await expect(
      page.getByRole('heading', { name: 'Meet your operating potential.' }),
    ).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: `test-results/workspace-${width}.png`, fullPage: true });
  }
  await page.goto('/admin');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: 'test-results/admin-login-mobile.png', fullPage: true });
  expect(errors).toEqual([]);
});
