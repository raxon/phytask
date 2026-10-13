import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const manifest = JSON.parse(
  readFileSync(resolve('apps/web/dist/.vite/manifest.json'), 'utf8'),
) as Record<string, { file: string; isDynamicEntry?: boolean }>;

const routes = [
  {
    path: '/',
    name: 'Workspace',
    page: 'workspace',
    module: 'src/features/workspace/pages/WorkspacePage.tsx',
    otherModule: 'src/features/sessions/pages/HistoryPage.tsx',
    otherName: 'Session history',
  },
  {
    path: '/history',
    name: 'Session history',
    page: 'session history',
    module: 'src/features/sessions/pages/HistoryPage.tsx',
    otherModule: 'src/features/workspace/pages/WorkspacePage.tsx',
    otherName: 'Workspace',
  },
] as const;

for (const route of routes) {
  test(`loads ${route.name} on demand while keeping navigation available`, async ({ page }) => {
    const current = manifest[route.module]!;
    const other = manifest[route.otherModule]!;
    expect(current.isDynamicEntry).toBe(true);
    expect(other.isDynamicEntry).toBe(true);
    const requests: string[] = [];
    page.on('request', (request) => requests.push(new URL(request.url()).pathname));

    let release!: () => void;
    const gate = new Promise<void>((resolveGate) => {
      release = resolveGate;
    });
    let arrived!: () => void;
    const chunkRequested = new Promise<void>((resolveArrived) => {
      arrived = resolveArrived;
    });
    await page.route(`**/${current.file}`, async (request) => {
      arrived();
      await gate;
      await request.continue();
    });

    try {
      await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      await chunkRequested;
      await expect(page.getByRole('status')).toHaveText(`Loading ${route.page}...`);
      await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
      await expect(page.getByLabel('DEMO PATIENT')).toBeVisible();
      expect(requests).toContain(`/${current.file}`);
      expect(requests).not.toContain(`/${other.file}`);
    } finally {
      release();
    }

    await expect(page.getByText(`Loading ${route.page}...`, { exact: true })).toHaveCount(0);
    if (route.path === '/') await expect(page.getByTestId('rep-count')).toHaveText('0reps');
    else await expect(page.getByRole('heading', { name: /^Saved sessions/ })).toBeVisible();

    await page.getByRole('link', { name: route.otherName, exact: true }).click();
    if (route.otherName === 'Workspace')
      await expect(page.getByTestId('rep-count')).toHaveText('0reps');
    else await expect(page.getByRole('heading', { name: /^Saved sessions/ })).toBeVisible();
    expect(requests).toContain(`/${other.file}`);

    await page.getByRole('link', { name: route.name, exact: true }).click();
    await expect(page.getByText(`Loading ${route.page}...`, { exact: true })).toHaveCount(0);
    expect(requests.filter((path) => path === `/${current.file}`)).toHaveLength(1);
    expect(requests.filter((path) => path === `/${other.file}`)).toHaveLength(1);
  });
}
