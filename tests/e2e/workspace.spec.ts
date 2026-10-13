import { test, expect, type Page, type Request } from '@playwright/test';
import { resolve } from 'node:path';
import type { Fixture } from '@rep-counter/contracts/fixture';
import type { SessionResult } from '@rep-counter/contracts/session';

const fixturePath = resolve('packages/demo-data/fixtures/session-noisy.json');
const shortFixture: Fixture = { sampleRateHz: 30, angles: [172, 99, 160, 161], expectedReps: 1 };
const twoRepFixture: Fixture = { sampleRateHz: 30, angles: [99, 161, 99, 161], expectedReps: 2 };

test('resumes a disconnected demo stream without losing a bent-to-standing transition', async ({
  page,
}) => {
  const posts: Request[] = [];
  page.on('request', (request) => {
    if (isSessionPost(request)) posts.push(request);
  });
  let interrupted = false;
  await page.route('**/signal-stream?**', async (route) => {
    if (interrupted) {
      await route.continue();
      return;
    }
    interrupted = true;
    const response = await route.fetch();
    const events = (await response.text()).split('\n\n');
    // Sample 109 is 159.2 degrees; sample 110 completes the first squat.
    await route.fulfill({ response, body: events.slice(0, 111).join('\n\n') + '\n\n' });
  });
  await page.goto('/');
  const before = await historyCount(page);
  await startAt8x(page);
  await expect(page.getByRole('alert')).toContainText('signal connection ended');
  await expect(page.getByTestId('samples-received')).toHaveText('110');
  await expect(page.getByTestId('rep-count')).toHaveText('0reps');
  expect(posts).toHaveLength(0);
  const resumed = page.waitForRequest(
    (request) => new URL(request.url()).pathname === '/signal-stream',
  );
  const saved = page.waitForResponse((response) => isSessionPost(response.request()));
  await page.getByRole('button', { name: 'Resume signal', exact: true }).click();
  expect(new URL((await resumed).url()).searchParams.get('from')).toBe('110');
  expect((await saved).status()).toBe(201);
  await expectSaved(page);
  expect(posts).toHaveLength(1);
  expect(expectResultOnly(posts[0]!).reps).toBe(10);
  await expect(page.getByTestId('samples-received')).toHaveText('1,088');
  await expect(page.getByTestId('duration')).toHaveText('36.3s');
  expect(await historyCount(page)).toBe(before + 1);
});

function isSessionPost(request: Request) {
  return request.method() === 'POST' && new URL(request.url()).pathname === '/sessions';
}

async function historyCount(page: Page, patient: 'alex' | 'jamie' = 'alex') {
  const response = await page.request.get('/sessions', {
    headers: { authorization: 'Bearer demo-' + patient + '-token' },
  });
  expect(response.ok()).toBe(true);
  return (await response.json()).length as number;
}

async function importFixture(page: Page, fixture: Fixture) {
  await page.getByLabel('Import session JSON').setInputFiles({
    name: 'local-session.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture)),
  });
  await expect(page.getByTestId('rep-count')).toHaveText('0reps');
}

async function startAt8x(page: Page) {
  await page
    .getByRole('group', { name: 'Playback speed' })
    .getByRole('button', { name: '8x', exact: true })
    .click();
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
}

async function expectSaved(page: Page) {
  await expect(
    page.getByRole('status').filter({ hasText: 'Session saved successfully.' }),
  ).toHaveText('Session saved successfully.');
}

function expectResultOnly(request: Request): SessionResult {
  const result = request.postDataJSON() as SessionResult;
  expect(Object.keys(result).sort()).toEqual(['durationSec', 'performedAt', 'reps', 'sessionId']);
  expect(request.headers().authorization).toBe('Bearer demo-alex-token');
  return result;
}

test('streams all examples and plays imported fixtures locally before automatically saving', async ({
  page,
}) => {
  test.setTimeout(45000);
  const signalRequests: Request[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/signal-stream') signalRequests.push(request);
  });
  await page.goto('/');
  await expect(page.getByTestId('rep-count')).toHaveText('0reps');
  await expect(page.getByRole('button', { name: 'Save session', exact: true })).toHaveCount(0);

  for (const example of [
    { name: 'Clean signal', fixture: 'clean', reps: 10, duration: '36.3s' },
    { name: 'Noisy signal', fixture: 'noisy', reps: 8, duration: '27.6s' },
    { name: 'Shallow squats', fixture: 'shallow', reps: 7, duration: '36.0s' },
  ]) {
    await page.getByRole('button', { name: new RegExp(example.name) }).click();
    await expect(page.getByTestId('rep-count')).toHaveText('0reps');
    const streamRequest = page.waitForRequest(
      (request) => new URL(request.url()).pathname === '/signal-stream',
    );
    const saved = page.waitForResponse((response) => isSessionPost(response.request()));
    await startAt8x(page);
    const request = await streamRequest;
    const url = new URL(request.url());
    expect(request.method()).toBe('GET');
    expect(request.headers().authorization).toBe('Bearer demo-alex-token');
    expect(url.searchParams.get('fixture')).toBe(example.fixture);
    expect(url.searchParams.get('speed')).toBe('8');
    expect(url.searchParams.get('from')).toBe('0');
    expect((await saved).status()).toBe(201);
    await expectSaved(page);
    await expect(page.getByTestId('rep-count')).toHaveText(example.reps + 'reps');
    await expect(page.getByTestId('duration')).toHaveText(example.duration);
    await expect(page.getByRole('img', { name: /Knee angle over/ })).toBeVisible();
  }

  expect(signalRequests).toHaveLength(3);
  await page.getByLabel('Import session JSON').setInputFiles(fixturePath);
  await expect(page.getByTestId('rep-count')).toHaveText('0reps');
  const importedSave = page.waitForResponse((response) => isSessionPost(response.request()));
  await startAt8x(page);
  const importedResponse = await importedSave;
  expect(importedResponse.status()).toBe(201);
  expect(expectResultOnly(importedResponse.request()).reps).toBe(8);
  await expectSaved(page);
  await expect(page.getByTestId('rep-count')).toHaveText('8reps');
  await expect(page.getByTestId('duration')).toHaveText('27.6s');
  expect(signalRequests).toHaveLength(3);
});

test('counts progressively through navigation and saves only the frozen partial result on Finish', async ({
  page,
}) => {
  const partialFixture: Fixture = {
    sampleRateHz: 30,
    expectedReps: 2,
    angles: [
      ...Array<number>(15).fill(172),
      ...Array<number>(15).fill(99),
      ...Array<number>(600).fill(161),
      99,
      161,
    ],
  };
  const posts: Request[] = [];
  const streams: Request[] = [];
  page.on('request', (request) => {
    if (isSessionPost(request)) posts.push(request);
    if (new URL(request.url()).pathname === '/signal-stream') streams.push(request);
  });
  await page.goto('/');
  const before = await historyCount(page);
  const beforeJamie = await historyCount(page, 'jamie');
  await importFixture(page, partialFixture);
  await page
    .getByRole('group', { name: 'Playback speed' })
    .getByRole('button', { name: '1x', exact: true })
    .click();
  await page.getByRole('button', { name: 'Start session', exact: true }).click();
  await expect(page.getByLabel('DEMO PATIENT')).toBeDisabled();
  await expect(page.getByRole('button', { name: /Noisy signal/ })).toBeDisabled();
  await expect(
    page
      .getByRole('group', { name: 'Playback speed' })
      .getByRole('button', { name: '8x', exact: true }),
  ).toBeDisabled();
  await expect(page.getByTestId('rep-count')).toHaveText('1reps');
  expect(posts).toHaveLength(0);
  expect(streams).toHaveLength(0);
  const elapsed = Number.parseFloat((await page.getByTestId('duration').textContent())!);

  await page.getByRole('link', { name: 'Session history', exact: true }).click();
  await expect(page).toHaveURL('/history');
  await expect(page.getByRole('heading', { name: /^Saved sessions/ })).toBeVisible();
  await expect(page.getByLabel('DEMO PATIENT')).toBeDisabled();
  expect(posts).toHaveLength(0);
  await page.getByRole('link', { name: 'Workspace', exact: true }).click();
  await expect(page.getByTestId('rep-count')).toHaveText('1reps');
  await expect
    .poll(async () => Number.parseFloat((await page.getByTestId('duration').textContent())!))
    .toBeGreaterThan(elapsed);
  expect(posts).toHaveLength(0);

  const sent = page.waitForRequest(isSessionPost);
  const saved = page.waitForResponse((response) => isSessionPost(response.request()));
  await page.getByRole('button', { name: 'Finish session', exact: true }).click();
  const result = expectResultOnly(await sent);
  expect(result.reps).toBe(1);
  expect(result.durationSec).toBeGreaterThan(0);
  expect(result.durationSec).toBeLessThan(
    partialFixture.angles.length / partialFixture.sampleRateHz,
  );
  expect((await saved).status()).toBe(201);
  await expectSaved(page);
  await expect(page.getByTestId('rep-count')).toHaveText('1reps');
  await expect(page.getByTestId('duration')).toHaveText(result.durationSec.toFixed(1) + 's');
  await expect(page.getByLabel('DEMO PATIENT')).toBeEnabled();
  expect(posts).toHaveLength(1);
  expect(await historyCount(page)).toBe(before + 1);

  await page.getByRole('link', { name: 'Session history', exact: true }).click();
  await expect(page.locator('tbody tr')).toHaveCount(before + 1);
  await page.getByLabel('DEMO PATIENT').selectOption('jamie');
  await expect(page.locator('tbody tr')).toHaveCount(beforeJamie);
  expect(await historyCount(page, 'jamie')).toBe(beforeJamie);
  await page.getByRole('link', { name: 'Workspace', exact: true }).click();
  await expect(page.getByTestId('rep-count')).toHaveText('-reps');
  expect(posts).toHaveLength(1);
});

test('keeps the same automatically saved result after a lost response, patient switch and reload', async ({
  page,
}) => {
  await page.goto('/');
  const before = await historyCount(page);
  await importFixture(page, shortFixture);
  let firstPayload: unknown;
  await page.route('**/sessions', async (route) => {
    if (!isSessionPost(route.request())) {
      await route.continue();
      return;
    }
    firstPayload = route.request().postDataJSON();
    await route.fetch();
    await route.abort('failed');
  });
  await startAt8x(page);
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
  await expect(page.getByTestId('rep-count')).toHaveText('1reps');
  await page.unroute('**/sessions');
  const retryRequest = page.waitForRequest(isSessionPost);
  const retryResponse = page.waitForResponse((response) => isSessionPost(response.request()));
  await page.getByRole('button', { name: 'Retry save' }).click();
  expect((await retryRequest).postDataJSON()).toEqual(firstPayload);
  expect((await retryResponse).status()).toBe(200);
  await expectSaved(page);
  expect(await historyCount(page)).toBe(before + 1);
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('rep-counter.pending.v1')!).pending),
    )
    .toEqual({});
});

test('a late automatic save response updates only its original patient', async ({ page }) => {
  await page.goto('/');
  await importFixture(page, shortFixture);
  let release!: () => void;
  const gate = new Promise<void>((resolveGate) => {
    release = resolveGate;
  });
  let arrived!: () => void;
  const atServer = new Promise<void>((resolveArrived) => {
    arrived = resolveArrived;
  });
  await page.route('**/sessions', async (route) => {
    if (!isSessionPost(route.request())) {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    arrived();
    await gate;
    await route.fulfill({ response });
  });
  await startAt8x(page);
  await atServer;
  try {
    await expect(page.getByLabel('DEMO PATIENT')).toBeEnabled();
    await page.getByLabel('DEMO PATIENT').selectOption('jamie');
    await page.getByRole('button', { name: /Noisy signal/ }).click();
  } finally {
    release();
  }
  await expect(page.getByTestId('rep-count')).toHaveText('0reps');
  await expect(page.getByRole('button', { name: /Noisy signal/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(page.getByRole('button', { name: 'Start session', exact: true })).toBeEnabled();
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('rep-counter.pending.v1')!).pending),
    )
    .toEqual({});
  await page.getByLabel('DEMO PATIENT').selectOption('alex');
  await expect(page.getByRole('button', { name: 'Retry save' })).toHaveCount(0);
});

test('a late history response cannot expose another patient history', async ({ page }) => {
  const beforeJamie = await historyCount(page, 'jamie');
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
  try {
    await page.getByLabel('DEMO PATIENT').selectOption('jamie');
  } finally {
    release();
  }
  await expect(page.locator('tbody tr')).toHaveCount(beforeJamie);
  if (beforeJamie === 0)
    await expect(
      page.getByText("Save a result in the workspace to begin Jamie's history."),
    ).toBeVisible();
  else await expect(page.getByText("Jamie Taylor's sessions")).toBeVisible();
});

test('rejects broken imports without replacing the prepared source', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Import session JSON').setInputFiles({
    name: 'broken.json',
    mimeType: 'application/json',
    buffer: Buffer.from('{broken'),
  });
  await expect(page.getByRole('alert')).toContainText('invalid JSON');
  await expect(page.getByTestId('rep-count')).toHaveText('0reps');
  await expect(page.getByRole('button', { name: /Clean signal/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByLabel('Import session JSON').setInputFiles({
    name: 'invalid.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ angles: [null], sampleRateHz: 30 })),
  });
  await expect(page.getByRole('alert')).toContainText('finite number');
  await importFixture(page, shortFixture);
  await expect(page.getByRole('alert')).toHaveCount(0);
  const saved = page.waitForResponse((response) => isSessionPost(response.request()));
  await startAt8x(page);
  expect((await saved).status()).toBe(201);
  await expectSaved(page);
  await expect(page.getByTestId('rep-count')).toHaveText('1reps');
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
  await expect(page.getByTestId('rep-count')).toHaveText('0reps');
  await expect(page.getByRole('button', { name: /Noisy signal/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
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
  await expect(page.getByTestId('rep-count')).toHaveText('0reps');
  await expect(page.getByRole('button', { name: /Noisy signal/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

for (const otherPatient of ['alex', 'jamie'] as const) {
  test(
    'coordinates concurrent automatic saves across tabs for ' + otherPatient,
    async ({ page, context }) => {
      const posts: Request[] = [];
      await context.route('**/sessions', async (route) => {
        if (isSessionPost(route.request())) {
          posts.push(route.request());
          await route.abort('failed');
        } else await route.continue();
      });
      await page.goto('/');
      const otherTab = await context.newPage();
      await otherTab.goto('/');
      await otherTab.getByLabel('DEMO PATIENT').selectOption(otherPatient);
      await importFixture(page, shortFixture);
      await importFixture(otherTab, twoRepFixture);

      // Both completed sessions must wait for the shared lock before sending any result.
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
        await startAt8x(page);
        await expect(page.getByRole('button', { name: 'Saving session...' })).toBeDisabled();
        await startAt8x(otherTab);
        await expect(otherTab.getByRole('button', { name: 'Saving session...' })).toBeDisabled();
        await expect(page.getByRole('button', { name: /Noisy signal/ })).toBeDisabled();
        expect(posts).toHaveLength(0);
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
      expect(pending.alex.reps).toBe(1);
      expect(Object.keys(pending).sort()).toEqual(
        otherPatient === 'alex' ? ['alex'] : ['alex', 'jamie'],
      );
      expect(posts).toHaveLength(otherPatient === 'alex' ? 1 : 2);
      if (otherPatient === 'jamie') expect(pending.jamie.reps).toBe(2);
    },
  );
}
