const { chromium } = require('playwright');

const url = process.env.MANKO_URL || 'https://manko.fun/movie-info/69e11f53131836087ea893b3?series=false';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const interesting = [];
  page.on('response', async (res) => {
    const u = res.url();
    const ct = (res.headers()['content-type'] || '').toLowerCase();
    if (/manko|movie|info|api|graphql/i.test(u) || ct.includes('application/json')) {
      let body = '';
      try { body = await res.text(); } catch {}
      if (body.length > 20000) body = body.slice(0, 20000) + '\n...[truncated]';
      interesting.push({ status: res.status(), url: u, contentType: ct, body });
    }
  });
  try {
    const resp = await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });
    console.log('PAGE_STATUS', resp && resp.status());
    console.log('FINAL_URL', page.url());
    console.log('TITLE', await page.title());
    console.log('BODY_TEXT_BEGIN');
    console.log((await page.locator('body').innerText()).slice(0, 20000));
    console.log('BODY_TEXT_END');
    console.log('NETWORK_BEGIN');
    for (const x of interesting) {
      console.log(JSON.stringify(x));
    }
    console.log('NETWORK_END');
  } catch (e) {
    console.error('PROBE_ERROR', e && e.stack || e);
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
})();
