import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.ROUTE_SCOUT_PLAYWRIGHT || 'playwright');
const origin = process.env.ROUTE_SCOUT_ORIGIN || 'http://127.0.0.1:4173';
const browser = await chromium.launch(process.env.ROUTE_SCOUT_CHROME ? { executablePath: process.env.ROUTE_SCOUT_CHROME } : {});
const base = (id, extra = {}) => ({ id, action: 'straight', title: 'Return Road', source: 'Continue along Return Road.', miles: .2, stops: 0, regular: 0, centralized: 0, service: false, manual: true, waypoint: null, ...extra });
const route = {
  version: 1, id: 'GREGORY-BROWSER-TEST', name: 'Gregory practice', area: 'Fictional town', map: null,
  steps: [base(1, { action: 'left', title: 'Gregory Street', source: 'Turn left onto Gregory Street and service two mailbox clusters.', stops: 2, centralized: 45, service: true,
    mailboxes: [{ label: 'First Gregory Street cluster', sequence: { start: 680, end: 712 } }, { label: 'Second Gregory Street cluster', sequence: { start: 713, end: 724 } }] }), base(2), base(3, { action: 'finish', title: 'Depot', source: 'Arrive at the depot.', miles: 0 })],
};
const importRoute = (page, data) => page.locator('#route-file').setInputFiles({ name: 'practice.route.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
const spoken = page => page.evaluate(() => window.testSpoken.at(-1));
try {
  for (const [name, width, height] of [['phone', 390, 844], ['desktop', 1280, 900]]) {
    const context = await browser.newContext({ viewport: { width, height } });
    await context.addInitScript(() => {
      window.testSpoken = [];
      Object.defineProperty(window, 'SpeechSynthesisUtterance', { value: class { constructor(text) { this.text = text; } } });
      Object.defineProperty(window, 'speechSynthesis', { value: {
        getVoices: () => [{ name: 'Local English', lang: 'en-US', localService: true }],
        cancel() {}, speak(utterance) { window.testSpoken.push(utterance.text); },
      } });
      localStorage.setItem('route-scout.settings.v1', JSON.stringify({ voice: true, awake: false, auto: false }));
    });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin);
    await page.locator('#route-name').filter({ hasText: 'Sample route' }).waitFor();
    await importRoute(page, route);
    await page.locator('#turn-title').filter({ hasText: 'Gregory Street' }).waitFor();
    assert.equal(await page.locator('#mailbox-guidance').count(), 1, 'Current mailbox panel is missing');
    assert.equal(await page.locator('#mailbox-sequence').textContent(), 'Sequence 680–712');
    assert.equal(await page.locator('#mailbox-position').textContent(), 'Mailbox 1 of 2');
    assert.doesNotMatch(await page.locator('#guide').innerText(), /713|724/, 'The next mailbox range must stay hidden until this mailbox is confirmed');
    await page.locator('#read-step').click();
    assert.match(await spoken(page), /Turn left onto Gregory Street/);
    assert.match(await spoken(page), /680 through 712/);
    assert.doesNotMatch(await spoken(page), /713|724/);
    await page.locator('#next').click();
    assert.equal(await page.locator('#progress-count').textContent(), 'Step 1 / 3');
    assert.equal(await page.locator('#mailbox-position').textContent(), 'Mailbox 2 of 2');
    assert.equal(await page.locator('#mailbox-sequence').textContent(), 'Sequence 713–724');
    assert.match(await spoken(page), /713 through 724/);
    assert.doesNotMatch(await spoken(page), /680|712|Turn left/);
    await page.reload();
    await page.locator('#turn-title').filter({ hasText: 'Gregory Street' }).waitFor();
    assert.equal(await page.locator('#mailbox-sequence').textContent(), 'Sequence 713–724');
    await page.locator('#previous').click();
    assert.equal(await page.locator('#mailbox-sequence').textContent(), 'Sequence 680–712');
    await page.locator('#next').click();
    await page.locator('#next').click();
    assert.equal(await page.locator('#progress-count').textContent(), 'Step 2 / 3');
    assert.equal(await page.locator('#mailbox-guidance').isVisible(), false);
    await page.locator('#previous').click();
    assert.equal(await page.locator('#mailbox-sequence').textContent(), 'Sequence 713–724');
    await page.locator('#read-step').click();
    assert.match(await spoken(page), /713 through 724/);
    assert.doesNotMatch(await spoken(page), /680|712/);
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
    await context.setOffline(true);
    await page.reload();
    await page.locator('#turn-title').filter({ hasText: 'Gregory Street' }).waitFor();
    assert.equal(await page.locator('#mailbox-sequence').textContent(), 'Sequence 713–724');
    await context.setOffline(false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth), true);
    await page.screenshot({ path: `/private/tmp/routescout-mailbox-${name}.png`, fullPage: true });
    const legacy = { ...route, id: 'LEGACY-BROWSER-TEST', name: 'Legacy route', steps: route.steps.map(s => { const { mailboxes, ...old } = s; return old; }) };
    await importRoute(page, legacy);
    await page.locator('#route-name').filter({ hasText: 'Legacy route' }).waitFor();
    assert.equal(await page.locator('#mailbox-guidance').isVisible(), false);
    await page.locator('#next').click();
    assert.equal(await page.locator('#progress-count').textContent(), 'Step 2 / 3');
    assert.deepEqual(errors, []);
    console.log(`${name}: selected range, real speech wiring, per-mailbox Next/Back, repeat, reload, offline resume, legacy routes and screen fit passed.`);
    await context.close();
  }
} finally { await browser.close(); }
