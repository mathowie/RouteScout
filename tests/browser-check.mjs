import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium, devices } = require(process.env.ROUTE_SCOUT_PLAYWRIGHT || 'playwright');
const origin = process.env.ROUTE_SCOUT_ORIGIN || 'http://127.0.0.1:4173';
const browser = await chromium.launch(process.env.ROUTE_SCOUT_CHROME ? { executablePath: process.env.ROUTE_SCOUT_CHROME } : {});
const sameText = async (page, selector, text) => {
  await page.locator(selector).waitFor({ state: 'visible' });
  try {
    await page.waitForFunction(([sel, value]) => document.querySelector(sel).textContent === value, [selector, text], { timeout: 6500 });
  } catch { assert.equal(await page.locator(selector).textContent(), text, selector); }
};
const tab = (page, title) => page.getByRole('navigation').filter({ visible: true }).getByRole('button', { name: title, exact: true });
const fix = (page, latitude, longitude, elapsed = 1200) =>
  page.evaluate(([lat, lon, ms]) => window.testGPS(lat, lon, ms), [latitude, longitude, elapsed]);
const fixture = {
  version: 1, id: 'BROWSER-FIXTURE', name: 'Test route', area: 'Test town', effective: '1/1/2026',
  steps: [
    { id: 1, action: 'straight', title: 'Elm Street', source: 'Continue on Elm Street', miles: .1, stops: 0, regular: 0, centralized: 0, waypoint: [45.2, -123.2] },
    { id: 2, action: 'right', title: 'Birch Road', source: 'Turn right and service the boxes', miles: .2, stops: 1, regular: 0, centralized: 12, waypoint: [45.201, -123.2] },
    { id: 3, action: 'left', title: 'Alder Way', source: 'Turn left at the north gate', miles: .3, stops: 0, regular: 0, centralized: 0, waypoint: [45.202, -123.2] },
  ],
};
const importRoute = (page, data) => page.locator('#route-file').setInputFiles({
  name: 'test.route.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)),
});

try {
  const context = await browser.newContext({
    ...devices['iPhone 13'], permissions: ['geolocation'], geolocation: { latitude: 45.2, longitude: -123.2, accuracy: 8 },
  });
  await context.addInitScript(() => {
    let receiver, sequenceTime = Date.now() - 12_000;
    const geo = {
      watchPosition(success) { receiver = success; return 1; },
      clearWatch() { receiver = null; },
    };
    Object.defineProperty(navigator, 'geolocation', { value: geo });
    window.testGPS = (latitude, longitude, elapsed) => {
      sequenceTime += elapsed;
      receiver?.({ timestamp: sequenceTime, coords: { latitude, longitude, accuracy: 8,
        altitude: null, altitudeAccuracy: null, heading: null, speed: null } });
    };
  });
  const page = await context.newPage();
  const external = [];
  const errors = [];
  page.on('request', request => {
    if (!request.url().startsWith(origin) && !request.url().startsWith('data:')) external.push(request.url());
  });
  page.on('pageerror', err => errors.push(err.message));
  await page.goto(origin);
  await sameText(page, '#route-name', 'Sample route');
  await importRoute(page, fixture);
  await sameText(page, '#route-name', 'Test route');

  if (process.argv.includes('--stale-tab')) {
    const second = await context.newPage();
    await second.goto(origin);
    await sameText(second, '#route-name', 'Test route');
    await importRoute(second, { ...fixture, id: 'REPLACEMENT', name: 'Replacement route' });
    await sameText(second, '#route-name', 'Replacement route');
    await second.getByRole('button', { name: 'Next step', exact: true }).click();
    await sameText(second, '#turn-title', 'Birch Road');
    await page.getByRole('button', { name: 'Next step', exact: true }).click();
    await second.reload();
    await sameText(second, '#turn-title', 'Birch Road');
    console.log('An old tab can’t overwrite a replacement run');
  } else if (process.argv.includes('--bad-map')) {
    await page.getByRole('button', { name: 'Next step', exact: true }).click();
    await importRoute(page, { ...fixture, id: 'BAD-MAP', name: 'Bad map', map: {
      image: 'data:image/png;base64,AAAA', width: 200, height: 200,
    } });
    await page.getByRole('status').filter({ hasText: 'Couldn’t import' }).waitFor({ timeout: 6000 });
    await page.reload();
    await sameText(page, '#turn-title', 'Birch Road');
    console.log('An unreadable map can’t replace a valid route');
  } else if (process.argv.includes('--demo-resume')) {
    await page.getByRole('button', { name: 'Next step', exact: true }).click();
    await tab(page, 'Settings').click();
    await page.getByRole('button', { name: 'Try demo', exact: true }).click();
    await page.getByRole('button', { name: 'Next step', exact: true }).click();
    await page.getByRole('button', { name: 'Mailbox done · Next mailbox', exact: true }).click();
    await sameText(page, '#mailbox-position', 'Mailbox 2 of 2');
    await tab(page, 'Settings').click();
    await page.getByRole('button', { name: 'Open saved route', exact: true }).click();
    await sameText(page, '#turn-title', 'Birch Road');
    await tab(page, 'Settings').click();
    await page.getByRole('button', { name: 'Try demo', exact: true }).click();
    await sameText(page, '#mailbox-position', 'Mailbox 2 of 2');
    await sameText(page, '#mailbox-sequence', 'Sequence 462–473');
    console.log('Switching to the demo preserves private progress');
  } else {
    await tab(page, 'Settings').click();
    await page.getByRole('switch', { name: /GPS advance/ }).check();
    await tab(page, 'Guide').click();
    await page.getByRole('button', { name: 'Enable GPS', exact: true }).click();
    await fix(page, 45.2, -123.2);
    await page.getByText('GPS advance is watching for the next turn.').waitFor();
    await fix(page, 45.201, -123.2);
    await fix(page, 45.20101, -123.2);
    await sameText(page, '#turn-title', 'Birch Road');
    await fix(page, 45.202, -123.2);
    await fix(page, 45.20201, -123.2);
    assert.equal(await page.locator('#turn-title').textContent(), 'Birch Road');
    await page.getByRole('button', { name: 'Service done · Next', exact: true }).click();
    await sameText(page, '#turn-title', 'Alder Way');
    await tab(page, 'Steps').click();
    await page.getByRole('searchbox').fill('north gate');
    assert.equal(await page.locator('.step-row').count(), 1);
    await page.locator('.step-row').click();
    await sameText(page, '#turn-title', 'Alder Way');

    await page.locator('#route-file').setInputFiles({
      name: 'invalid.json', mimeType: 'application/json', buffer: Buffer.from('{'),
    });
    await page.getByRole('status').filter({ hasText: 'Couldn’t import' }).waitFor();
    await sameText(page, '#turn-title', 'Alder Way');
    await tab(page, 'Settings').click();
    await page.getByText('App saved for offline use on this device.').waitFor();
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await context.setOffline(true);
    await page.reload();
    await tab(page, 'Guide').click();
    await sameText(page, '#turn-title', 'Alder Way');
    assert.equal(await page.locator('#gps-button-label').textContent(), 'Enable GPS');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.deepEqual(errors, []);
    assert.deepEqual(external, []);
    console.log('Mobile import, GPS advance, service confirmation, search, invalid-file recovery, and offline resume passed');
  }
} finally {
  await browser.close();
}
