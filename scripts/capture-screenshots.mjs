/**
 * Capture README screenshots from a running ONVIF-DVR UI.
 *
 * Prerequisites: API on :3001 and UI on :5173 (npm run dev) or SERVE_CLIENT on :3001.
 *
 *   node scripts/capture-screenshots.mjs
 */
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'docs', 'screenshots');
const baseUrl = process.env.SCREENSHOT_URL || 'http://localhost:5173';

fs.mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function shot(name) {
  const file = path.join(outDir, name);
  await page.screenshot({ path: file, type: 'png' });
  console.log(`wrote ${file}`);
}

async function expandSidebarSection(title) {
  const summary = page.getByRole('button', { name: new RegExp(title, 'i') });
  if (await summary.count()) {
    await summary.first().click();
    await page.waitForTimeout(400);
  }
}

await page.goto(baseUrl, { waitUntil: 'networkidle', timeout: 90_000 });
await page.waitForTimeout(6000);

await shot('live-view.png');

const multiview = page.getByRole('button', { name: 'Multiview' });
if (await multiview.count()) {
  await multiview.click();
  await page.waitForTimeout(1500);
  await shot('multiview.png');
}

const tabsBtn = page.getByRole('button', { name: 'Tabs' });
if (await tabsBtn.count()) {
  await tabsBtn.click();
  await page.waitForTimeout(800);
}

const playbackToggle = page.getByRole('button', { name: 'Playback' });
if (await playbackToggle.count()) {
  await playbackToggle.first().click();
  await page.waitForTimeout(1500);
  await shot('playback.png');
  const liveToggle = page.getByRole('button', { name: 'Live' });
  if (await liveToggle.count()) {
    await liveToggle.first().click();
    await page.waitForTimeout(800);
  }
}

await expandSidebarSection('Add Camera');
const onvifTab = page.getByRole('tab', { name: 'ONVIF Discovery' });
if (await onvifTab.count()) {
  await onvifTab.click();
  await page.waitForTimeout(500);
  await shot('onvif-discovery.png');

  const streamTab = page.getByRole('tab', { name: 'Stream URL' });
  if (await streamTab.count()) {
    await streamTab.click();
    await page.waitForTimeout(500);
    await shot('stream-url.png');
  }
}

await expandSidebarSection('Settings');
await page.waitForTimeout(500);
await shot('settings.png');

await browser.close();
