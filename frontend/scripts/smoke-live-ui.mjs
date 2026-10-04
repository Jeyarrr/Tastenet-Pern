import { chromium } from '@playwright/test';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createPool } from '../../backend/src/db.js';
import { readConfig } from '../../backend/src/config.js';
import { createSession } from '../../backend/src/auth.js';

const config = readConfig(), db = createPool(config.DATABASE_URL), base = process.env.UI_TEST_URL || 'http://localhost:5173';
const executablePath = [process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(value => value && fs.existsSync(value));
const browser = await chromium.launch({ executablePath });
const tokens = [];
try {
  for (const role of ['customer', 'admin', 'rider', 'superadmin']) {
    const person = (await db.query('SELECT id FROM tastenet.users WHERE role=$1 AND is_active LIMIT 1', [role])).rows[0];
    const token = await createSession(db, person.id, config); tokens.push(token);
    const context = await browser.newContext({ baseURL: base, viewport: { width: 1440, height: 1000 } });
    await context.addCookies([{ name: config.SESSION_COOKIE_NAME, value: token, url: base, httpOnly: true, sameSite: 'Lax' }]);
    const page = await context.newPage(), errors = [], failedApi = [];
    await page.route('https://www.google.com/maps/embed**', route => route.fulfill({ contentType: 'text/html', body: '<html><body>Map preview</body></html>' }));
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.url().startsWith(`${base}/api/`) && response.status() >= 400) failedApi.push(`${response.status()} ${new URL(response.url()).pathname}`); });
    const tabs = role === 'customer' ? [null] : role === 'admin' ? ['inventory', 'recipes', 'menu', 'tickets', 'history'] : role === 'rider' ? ['dashboard', 'history', 'profile'] : ['dashboard', 'inventory', 'recipes', 'menu', 'tickets', 'transactions', 'reports', 'customers', 'personnel', 'settings'];
    for (const tab of tabs) {
      await page.goto(`/${role}${tab ? `?page=${tab}` : ''}`, { waitUntil: 'networkidle' });
      await page.locator('main, .hero-container').first().waitFor({ state: 'visible', timeout: 20000 });
      assert.equal(await page.getByRole('heading',{name:'This page could not load'}).count(),0,'No error boundary fallback');
      assert.equal(await page.locator('.migration-notice.error').count(), 0, `${role}/${tab} server error notice`);
      if (role === 'customer') {
        const images = page.locator('.menu-featured-img');
        await images.evaluateAll(elements => elements.forEach(img => { img.loading = 'eager'; }));
        await page.waitForFunction(() => [...document.querySelectorAll('.menu-featured-img')].every(img => img.complete && img.naturalWidth > 0));
        console.log(`Customer menu: ${await images.count()} original food images loaded`);
      }
    }
    assert.deepEqual(errors, [], `${role} browser errors`);
    assert.deepEqual(failedApi, [], `${role} API failures`);
    console.log(`${role}: ${tabs.length} real database screens passed`);
    await context.close();
  }
} finally {
  await browser.close();
  for (const token of tokens) await db.query('DELETE FROM tastenet.auth_sessions WHERE token_hash=$1', [createHash('sha256').update(token).digest('hex')]);
  await db.end();
}
