const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.env.DIW_VISUAL_URL
  || 'http://127.0.0.1:4317/?run=20260724225108-af98b3';

(async () => {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    });
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') errors.push(message.text());
    });

    await page.goto(url, { waitUntil: 'networkidle' });

    await page.getByRole('button', { name: '変革マップ', exact: true }).click();
    const world = page.locator('[data-graph-world]');
    const beforeZoom = await world.getAttribute('transform');
    await page.getByRole('button', { name: '拡大', exact: true }).click();
    assert.notEqual(await world.getAttribute('transform'), beforeZoom, 'graph zoom should change the world transform');

    const typeFilter = page.locator('[data-graph-filter]:not([data-graph-filter="all"])').first();
    await typeFilter.click();
    assert.ok(await page.locator('[data-graph-node].filtered-out').count() > 0, 'graph filtering should hide non-matching nodes');
    await page.locator('[data-graph-filter="all"]').click();

    const secondNode = page.locator('[data-graph-node]').nth(1);
    await secondNode.focus();
    await page.keyboard.press('Enter');
    const secondNodeId = await secondNode.getAttribute('data-graph-node');
    assert.equal(await page.locator(`[data-graph-detail="${secondNodeId}"]`).isVisible(), true, 'selected graph node should open its inspector');

    await page.getByRole('button', { name: 'メガトレンド', exact: true }).click();
    await page.locator('[data-trend-index="1"]').first().click();
    assert.equal(await page.locator('[data-trend-card="1"]').getAttribute('class').then(value => value.includes('selected')), true, 'radar selection should synchronize with the trend inventory');

    await page.getByRole('button', { name: 'ホワイトスペース', exact: true }).click();
    await page.locator('[data-whitespace-index="1"]').first().click();
    assert.equal(await page.locator('[data-whitespace-detail="1"]').isVisible(), true, 'whitespace selection should reveal the matching opportunity brief');
    assert.equal(await page.locator('[data-whitespace-detail="0"]').isVisible(), false, 'the previous opportunity brief should close');

    await page.setViewportSize({ width: 390, height: 844 });
    for (const view of ['変革マップ', 'メガトレンド', 'ホワイトスペース']) {
      await page.getByRole('button', { name: view, exact: true }).click();
      const width = await page.evaluate(() => ({ viewport: window.innerWidth, page: document.documentElement.scrollWidth }));
      assert.ok(width.page <= width.viewport + 1, `${view} should not create horizontal page overflow on mobile`);
    }

    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ ok: true, checks: 11, url }, null, 2));
  } finally {
    if (browser) await browser.close();
  }
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
