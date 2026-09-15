const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/131.0.0.0 Safari/537.36'
  });
  const found = new Set();
  page.on('response', r => {
    const u = r.url();
    if (/\.(?:jpe?g|png|webp)(?:\?|$)/i.test(u)) found.add(u);
  });
  const target = 'https://www.japansm.com/product/snos-357/';
  console.log('opening', target);
  const res = await page.goto(target, { waitUntil: 'domcontentloaded', timeout: 60000 });
  console.log('status', res && res.status(), 'url', page.url(), 'title', await page.title());
  await page.waitForTimeout(5000);
  const data = await page.evaluate(() => {
    const attrs = ['src','data-src','data-lazy-src','srcset','data-srcset','href'];
    const urls = [];
    document.querySelectorAll('img,source,a').forEach(el => attrs.forEach(a => {
      const v = el.getAttribute(a); if (v) urls.push(v);
    }));
    const html = document.documentElement.outerHTML;
    const galleries = [...document.querySelectorAll('a')].map(a => a.href).filter(u => /gallery|preview|sample/i.test(u));
    return { text: document.body.innerText.slice(0,12000), urls, galleries, html };
  });
  for (const u of data.urls) {
    for (const part of u.split(',')) {
      const candidate = part.trim().split(/\s+/)[0];
      try {
        const abs = new URL(candidate, page.url()).href;
        if (/\.(?:jpe?g|png|webp)(?:\?|$)/i.test(abs)) found.add(abs);
      } catch {}
    }
  }
  console.log('gallery links', JSON.stringify(data.galleries, null, 2));
  console.log('image urls', JSON.stringify([...found], null, 2));
  fs.writeFileSync('japansm-snos357.html', data.html);
  fs.writeFileSync('japansm-snos357-result.json', JSON.stringify({target,status:res&&res.status(),finalUrl:page.url(),title:await page.title(),galleries:data.galleries,images:[...found],text:data.text}, null, 2));
  for (const g of data.galleries.slice(0,5)) {
    try {
      console.log('opening gallery', g);
      const gr = await page.goto(g, { waitUntil:'domcontentloaded', timeout:60000 });
      await page.waitForTimeout(3000);
      console.log('gallery status', gr && gr.status(), 'url', page.url());
      const imgs = await page.evaluate(() => [...document.querySelectorAll('img')].flatMap(i => [i.src,i.getAttribute('data-src'),i.getAttribute('data-lazy-src')]).filter(Boolean));
      console.log('gallery images', JSON.stringify(imgs, null, 2));
    } catch(e) { console.log('gallery error', String(e)); }
  }
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
