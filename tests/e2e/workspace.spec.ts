import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const fixturePath = resolve('packages/demo-data/fixtures/session-noisy.json');

async function historyCount(page: Page) {
  const response = await page.request.get('/sessions', {
    headers: { authorization: 'Bearer demo-alex-token' },
  });
  return (await response.json()).length as number;
}

test('analyzes all examples and uploads local fixtures', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('rep-count')).toHaveText('10reps');
  await page.getByRole('button', { name: /Noisy signal/ }).click();
  await expect(page.getByTestId('rep-count')).toHaveText('8reps');
  await expect(page.getByTestId('duration')).toHaveText('27.6s');
  await page.getByRole('button', { name: /Shallow squats/ }).click();
  await expect(page.getByTestId('rep-count')).toHaveText('7reps');
  await page.getByLabel('Import session JSON').setInputFiles(fixturePath);
  await expect(page.getByTestId('rep-count')).toHaveText('8reps');
  await expect(page.getByRole('img', { name: /Knee angle over/ })).toBeVisible();
});

test('sends only a result, saves history and isolates the selected patient', async ({ page }) => {
  await page.goto('/');
  const before = await historyCount(page);
  const sent = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().endsWith('/sessions'),
  );
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  const request = await sent;
  expect(Object.keys(request.postDataJSON()).sort()).toEqual([
    'durationSec',
    'performedAt',
    'reps',
    'sessionId',
  ]);
  expect(request.headers().authorization).toBe('Bearer demo-alex-token');
  await expect(page.getByRole('button', { name: 'Saved to history' })).toBeDisabled();
  expect(await historyCount(page)).toBe(before + 1);
  await page.getByRole('link', { name: 'Session history', exact: true }).click();
  await expect(page).toHaveURL('/history');
  await expect(page.locator('tbody tr')).toHaveCount(before + 1);
  await page.getByLabel('DEMO PATIENT').selectOption('jamie');
  await expect(
    page.getByText("Save a result in the workspace to begin Jamie's history."),
  ).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(0);
  await page.getByRole('link', { name: 'Workspace', exact: true }).click();
  await expect(page.getByTestId('rep-count')).toHaveText('-reps');
  await page.getByLabel('DEMO PATIENT').selectOption('alex');
  await page.getByRole('link', { name: 'Session history', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(before + 1);
});

test('keeps the same result after a lost response, patient switch and reload', async ({ page }) => {
  await page.goto('/');
  const before = await historyCount(page);
  let firstPayload: unknown;
  await page.route('**/sessions', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    firstPayload = route.request().postDataJSON();
    await route.fetch();
    await route.abort('failed');
  });
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('server did not confirm');
  await expect(page.getByRole('button', { name: /Noisy signal/ })).toBeDisabled();
  expect(await historyCount(page)).toBe(before + 1);
  const stored = await page.evaluate(() => localStorage.getItem('rep-counter.pending.v1'));
  expect(stored).not.toContain('angles');
  expect(stored).not.toContain('token');
  await page.getByLabel('DEMO PATIENT').selectOption('jamie');
  await expect(page.getByTestId('rep-count')).toHaveText('-reps');
  await page.getByLabel('DEMO PATIENT').selectOption('alex');
  await expect(page.getByRole('button', { name: 'Retry save' })).toBeEnabled();
  await page.reload();
  await expect(page.getByTestId('rep-count')).toHaveText('10reps');
  await page.unroute('**/sessions');
  const retryRequest = page.waitForRequest(
    (req) => req.method() === 'POST' && req.url().endsWith('/sessions'),
  );
  const retryResponse = page.waitForResponse(
    (res) => res.request().method() === 'POST' && res.url().endsWith('/sessions'),
  );
  await page.getByRole('button', { name: 'Retry save' }).click();
  expect((await retryRequest).postDataJSON()).toEqual(firstPayload);
  expect((await retryResponse).status()).toBe(200);
  await expect(page.getByRole('status')).toHaveText('Session saved successfully.');
  expect(await historyCount(page)).toBe(before + 1);
  const pending = await page.evaluate(
    () => JSON.parse(localStorage.getItem('rep-counter.pending.v1')!).pending,
  );
  expect(pending).toEqual({});
});

test('a late save response updates only its original patient', async ({ page }) => {
  await page.goto('/');
  let release!: () => void;
  const gate = new Promise<void>((resolveGate) => {
    release = resolveGate;
  });
  let arrived!: () => void;
  const atServer = new Promise<void>((resolveArrived) => {
    arrived = resolveArrived;
  });
  await page.route('**/sessions', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    arrived();
    await gate;
    await route.fulfill({ response });
  });
  await page.getByRole('button', { name: 'Save session', exact: true }).click();
  await atServer;
  await page.getByLabel('DEMO PATIENT').selectOption('jamie');
  await page.getByRole('button', { name: /Noisy signal/ }).click();
  release();
  await expect(page.getByTestId('rep-count')).toHaveText('8reps');
  await expect(page.getByRole('button', { name: 'Save session', exact: true })).toBeEnabled();
  await expect(page.getByText("Add this result to Jamie's history")).toBeVisible();
  await page.getByLabel('DEMO PATIENT').selectOption('alex');
  await expect(page.getByRole('button', { name: 'Retry save' })).toHaveCount(0);
});

test('a late history response cannot expose another patient history', async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolveGate) => {
    release = resolveGate;
  });
  let arrived!: () => void;
  const queried = new Promise<void>((resolveArrived) => {
    arrived = resolveArrived;
  });
  await page.route('**/sessions', async (route) => {
    if (
      route.request().method() === 'GET' &&
      route.request().headers().authorization === 'Bearer demo-alex-token'
    ) {
      const response = await route.fetch();
      arrived();
      await gate;
      await route.fulfill({ response });
    } else await route.continue();
  });
  await page.goto('/history');
  await queried;
  await page.getByLabel('DEMO PATIENT').selectOption('jamie');
  release();
  await expect(
    page.getByText("Save a result in the workspace to begin Jamie's history."),
  ).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(0);
});

test('rejects broken imports without replacing a valid analysis', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Import session JSON').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{broken'),
  });
  await expect(page.getByRole('alert')).toContainText('invalid JSON');
  await expect(page.getByTestId('rep-count')).toHaveText('10reps');
  await page.getByLabel('Import session JSON').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ angles: [null], sampleRateHz: 30 })),
  });
  await expect(page.getByRole('alert')).toContainText('finite number');
  await page.getByLabel('Import session JSON').setInputFiles({
    name: 'noisy.json',
    mimeType: 'application/json',
    buffer: readFileSync(fixturePath),
  });
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.getByTestId('rep-count')).toHaveText('8reps');
});

test('fits a small screen and supports keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to workspace' })).toBeFocused();
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.screenshot({ path: 'test-results/mobile.png', fullPage: true });
  await page.getByRole('link', { name: 'Session history', exact: true }).click();
  await expect(page).toHaveURL('/history');
  await expect(page.getByRole('heading', { level: 1, name: 'Session history.' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});

test('history is a separate page with direct access, reload and browser navigation', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('#history')).toHaveCount(0);
  await page.getByRole('button', { name: /Noisy signal/ }).click();
  await page.getByRole('link', { name: 'Session history', exact: true }).click();
  await expect(page).toHaveURL('/history');
  await expect(page.getByRole('link', { name: 'Session history', exact: true })).toHaveAttribute(
    'aria-current',
    'page',
  );
  await expect(page.getByTestId('rep-count')).toHaveCount(0);
  await page.getByRole('link', { name: 'Workspace', exact: true }).click();
  await expect(page.getByTestId('rep-count')).toHaveText('8reps');
  await page.goBack();
  await expect(page).toHaveURL('/history');
  const response = await page.reload();
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { level: 1, name: 'Session history.' })).toBeVisible();
  await page.goto('/history');
  await expect(page.getByRole('heading', { level: 1, name: 'Session history.' })).toBeVisible();
});

test('ignores a file read that finishes after switching patients', async ({ page }) => {
  await page.addInitScript(() => {
    const read = File.prototype.text;
    File.prototype.text = async function () {
      await new Promise((resolveRead) => setTimeout(resolveRead, 400));
      const text = await read.call(this);
      document.documentElement.dataset.fixtureRead = 'done';
      return text;
    };
  });
  await page.goto('/');
  await page
    .getByLabel('Import session JSON')
    .setInputFiles(resolve('packages/demo-data/fixtures/session-clean.json'));
  await page.getByLabel('DEMO PATIENT').selectOption('jamie');
  await page.getByRole('button', { name: /Noisy signal/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-fixture-read', 'done');
  await expect(page.getByTestId('rep-count')).toHaveText('8reps');
  await expect(page.getByText("Add this result to Jamie's history")).toBeVisible();
});

for (const otherPatient of ['alex', 'jamie'] as const) {
  test(`coordinates concurrent pending saves across tabs for ${otherPatient}`, async ({
    page,
    context,
  }) => {
    await context.route('**/sessions', async (route) => {
      if (route.request().method() === 'POST') await route.abort('failed');
      else await route.continue();
    });
    await page.goto('/');
    const otherTab = await context.newPage();
    await otherTab.goto('/');
    await otherTab.getByLabel('DEMO PATIENT').selectOption(otherPatient);
    await otherTab.getByRole('button', { name: /Noisy signal/ }).click();

    // Hold the real browser lock so both saves wait before touching local storage.
    await page.evaluate(() => {
      void navigator.locks.request(
        'rep-counter.pending.v1',
        () =>
          new Promise<void>((release) => {
            window.addEventListener('release-retry-lock', () => release(), { once: true });
            document.documentElement.dataset.retryLock = 'held';
          }),
      );
    });
    await expect(page.locator('html')).toHaveAttribute('data-retry-lock', 'held');
    try {
      await page.getByRole('button', { name: 'Save session', exact: true }).click();
      await otherTab.getByRole('button', { name: 'Save session', exact: true }).click();
      await expect(page.getByRole('button', { name: 'Saving session...' })).toBeDisabled();
      await expect(otherTab.getByRole('button', { name: 'Saving session...' })).toBeDisabled();
      await expect(page.getByRole('button', { name: /Noisy signal/ })).toBeDisabled();
    } finally {
      await page.evaluate(() => window.dispatchEvent(new Event('release-retry-lock')));
    }

    await expect(page.getByRole('alert')).toContainText('server did not confirm');
    await expect(otherTab.getByRole('alert')).toContainText(
      otherPatient === 'alex' ? 'Another tab' : 'server did not confirm',
    );
    const pending = await page.evaluate(
      () => JSON.parse(localStorage.getItem('rep-counter.pending.v1')!).pending,
    );
    expect(pending.alex.reps).toBe(10);
    expect(Object.keys(pending).sort()).toEqual(
      otherPatient === 'alex' ? ['alex'] : ['alex', 'jamie'],
    );
    if (otherPatient === 'jamie') expect(pending.jamie.reps).toBe(8);
  });
}
