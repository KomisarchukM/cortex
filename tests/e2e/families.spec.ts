import { translate } from '../../shared/localization';
import { test, expect, type Page } from '@playwright/test';
import { modules } from '../../shared/modules';
import { generate } from '../../server/generators';
async function call(page: Page, path: string, method = 'GET', body?: any) {
  return page.evaluate(
    async ({ path, method, body }) => {
      const r = await fetch('/api' + path, {
        method,
        headers: { 'Content-Type': 'application/json', 'x-cortex-request': '1' },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return r.json();
    },
    { path, method, body },
  );
}
for (const locale of ['en', 'uk'] as const) {
  test(`every task family renders and completes without browser errors (${locale})`, async ({
    page,
  }) => {
    const t = (value: string) => translate(value, locale);
    test.setTimeout(180000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text());
    });
    await page.goto('/');
    if (locale === 'uk') await page.getByLabel('Language', { exact: true }).selectOption('uk');
    const ids = modules.map((m) => m.id);
    const s = await call(page, '/sessions', 'POST', {
      alias: 'All dimensions browser QA',
      mode: 'custom',
      locale,
      custom: { moduleIds: ids, rounds: 1 },
    });
    await page.goto('/assessment');
    for (let index = 0; index < ids.length; index++) {
      await page.getByRole('button', { name: t('Enter module') }).click();
      await page.getByRole('button', { name: t('Start trial →') }).click();
      const { challenge: c, answer } = generate(s.seed, s.plan, index, 2, locale);
      switch (c.family) {
        case 'reaction':
          if (c.data.go) {
            await expect(page.locator('.reaction-field.go')).toBeVisible({ timeout: 10000 });
            if (c.data.variant === 'choice')
              await page
                .getByRole('button', {
                  name: t(answer === 'LEFT' ? '← LEFT' : 'RIGHT →'),
                  exact: true,
                })
                .click();
            else await page.keyboard.press('Space');
          } else
            await expect(page.getByRole('button', { name: t('Enter module') })).toBeVisible({
              timeout: 10000,
            });
          break;
        case 'grid':
          await expect(page.getByRole('button', { name: t('Cell 1'), exact: true })).toBeEnabled({
            timeout: 10000,
          });
          for (const n of answer)
            await page.getByRole('button', { name: t(`Cell ${n + 1}`), exact: true }).click();
          break;
        case 'span':
          await page.getByLabel(t('Sequence'), { exact: true }).fill(answer);
          break;
        case 'sequence':
          await expect(
            page.getByRole('button', { name: t('Position 1'), exact: true }),
          ).toBeEnabled({
            timeout: 10000,
          });
          for (const n of answer)
            await page.getByRole('button', { name: t(`Position ${n + 1}`), exact: true }).click();
          break;
        case 'recognition':
          if (c.data.recall) await page.getByLabel(t('Word sequence')).fill(answer);
          else await page.locator('.option').nth(answer).click();
          break;
        case 'search':
          await page
            .getByRole('button', {
              name: t(`Symbol ${answer + 1}: ${c.data.targetSymbol}`),
              exact: true,
            })
            .click();
          break;
        case 'stroop':
        case 'match':
        case 'choice':
        case 'pattern':
        case 'rule':
          await page.locator('.option').nth(answer).click();
          break;
        case 'spatial':
          if (c.data.variant === 0)
            await page.getByRole('button', { name: t(`${answer * 90}°`), exact: true }).click();
          else await page.locator('.option').nth(answer).click();
          break;
        case 'decision':
          await page.locator('.option').first().click();
          break;
        case 'switch':
          await page.locator('.option').nth(answer).click();
          break;
        case 'multi':
          await page.getByLabel(t('Answer'), { exact: true }).fill(String(answer));
          await expect(page.getByRole('button', { name: t('Enter module') })).toBeVisible({
            timeout: 20000,
          });
          break;
        case 'estimate':
          await page.getByLabel(t('Estimated count')).fill(String(answer));
          break;
        case 'interval':
          await page.getByRole('button', { name: t('Start interval') }).click();
          await page.waitForTimeout(200);
          await page.getByRole('button', { name: t('Stop interval') }).click();
          break;
        case 'motor':
          for (const target of c.data.targets) {
            const field = await page.locator('.motor-field').boundingBox();
            await page.mouse.click(
              field!.x + (field!.width * target.x) / 100,
              field!.y + (field!.height * target.y) / 100,
            );
          }
          break;
        case 'typing':
          await page.getByLabel(t('Transcription')).fill(answer);
          break;
        case 'error':
          await page.locator('.error-table button').nth(answer).click();
          break;
      }
      if (!['reaction', 'search', 'switch', 'multi', 'interval', 'motor'].includes(c.family))
        await page.getByRole('button', { name: t('Submit response →') }).click();
      if (locale === 'uk' && index === 2) {
        await page.getByRole('button', { name: 'Призупинити сесію' }).click();
        await page.evaluate(() => localStorage.setItem('cortex-language', 'en'));
        await page.reload();
        await expect(page.getByRole('heading', { name: 'Сесію призупинено.' })).toBeVisible();
        expect((await call(page, '/session')).locale).toBe('uk');
        await page.getByRole('button', { name: 'Продовжити тестування' }).click();
      }
    }
    await expect(page.locator('.score-reveal')).toBeVisible();
    expect((await call(page, '/session')).cursor).toBe(30);
    expect(errors).toEqual([]);
    await page.screenshot({
      path: `test-results/results-full-desktop-${locale}.png`,
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({
      path: `test-results/results-full-mobile-${locale}.png`,
      fullPage: true,
    });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
test('matrix, word recall, streaming attention and dragging variants execute', async ({ page }) => {
  test.setTimeout(90000);
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  const s = await call(page, '/sessions', 'POST', {
    alias: 'Variant instrument QA',
    mode: 'custom',
    custom: { moduleIds: ['pattern', 'verbal-memory', 'attention', 'precision'], rounds: 4 },
  });
  await page.goto('/assessment');
  for (let index = 0; index < 16; index++) {
    if (index % 4 === 0) await page.getByRole('button', { name: 'Enter module' }).click();
    await page.getByRole('button', { name: 'Start trial' }).click();
    const state = await call(page, '/session');
    const { challenge: c, answer } = generate(s.seed, s.plan, index, state.difficulty);
    if (c.family === 'pattern') {
      if (c.data.matrix) await expect(page.locator('.pattern-matrix')).toBeVisible();
      await page.locator('.option').nth(answer).click();
      await page.getByRole('button', { name: 'Submit response' }).click();
    } else if (c.family === 'recognition') {
      if (c.data.recall) await page.getByLabel('Word sequence').fill(answer);
      else await page.locator('.option').nth(answer).click();
      await page.getByRole('button', { name: 'Submit response' }).click();
    } else if (c.family === 'search') {
      if (c.data.stream) {
        await expect(page.locator('.detection-instrument')).toBeVisible();
        await expect(
          page
            .getByRole('button', { name: 'Start trial' })
            .or(page.getByRole('button', { name: 'Enter module' })),
        ).toBeVisible({ timeout: 30000 });
      } else
        await page
          .getByRole('button', {
            name: `Symbol ${answer + 1}: ${c.data.targetSymbol}`,
            exact: true,
          })
          .click();
    } else if (c.family === 'motor') {
      if (c.data.variant === 2) await page.getByRole('button', { name: 'Stop marker' }).click();
      else
        for (const target of c.data.targets) {
          const field = await page.locator('.motor-field').boundingBox();
          const x = field!.x + (field!.width * target.x) / 100,
            y = field!.y + (field!.height * target.y) / 100;
          if (c.data.variant === 3) {
            await page.mouse.move(field!.x + field!.width / 2, field!.y + field!.height / 2);
            await page.mouse.down();
            await page.mouse.move(x, y, { steps: 4 });
            await page.mouse.up();
          } else await page.mouse.click(x, y);
        }
    }
  }
  await expect(page.locator('.score-reveal')).toBeVisible();
  expect(errors).toEqual([]);
});
