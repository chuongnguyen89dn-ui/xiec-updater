const { chromium } = require('playwright');
const fs = require('fs');

const targets = [
  { code:'MIKR-084', primary:'https://javsubtitled.com/movie/mikr00084', fallback:'https://www.japansm.com/product/mikr-084/' },
  { code:'SNOS-357', primary:'https://javsubtitled.com/movie/snos00357', fallback:'https://www.japansm.com/product/snos-357/' }
];
const isImage=u=>/\.(?:jpe?g|png|webp)(?:\?|$)/i.test(u||'');
const uniq=a=>[...new Set(a.filter(Boolean))];
async function probe(browser,url,code){
 const page=await browser.newPage({viewport:{width:1440,height:1000}}); const responses=[];
 page.on('response',r=>{if(isImage(r.url()))responses.push(r.url())});
 try{
  const r=await page.goto(url,{waitUntil:'domcontentloaded',timeout:60000}); await page.waitForTimeout(7000);
  const title=await page.title(); const text=(await page.locator('body').innerText()).slice(0,30000);
  const dom=await page.evaluate(()=>{const a=[];for(const e of document.querySelectorAll('img,source,a'))for(const k of ['src','data-src','data-lazy-src','srcset','data-srcset','href']){const v=e.getAttribute(k);if(v)for(const p of v.split(',').map(x=>x.trim().split(/\s+/)[0]))try{a.push(new URL(p,location.href).href)}catch{}}return a});
  const images=uniq([...responses,...dom]).filter(isImage); const norm=code.toLowerCase().replace(/[^a-z0-9]/g,'');
  const exactImages=images.filter(u=>u.toLowerCase().replace(/[^a-z0-9]/g,'').includes(norm)|| (code==='MIKR-084'&&/mikr0*084/i.test(u)) || (code==='SNOS-357'&&/snos0*357/i.test(u)));
  const html=await page.content(); await page.close(); return {url,status:r&&r.status(),title,text,images,exactImages,html};
 }catch(e){await page.close();return {url,error:String(e),images:[],exactImages:[],text:'',html:''}}
}
(async()=>{
 const browser=await chromium.launch({headless:true}); const results=[];
 for(const t of targets){
  const primary=await probe(browser,t.primary,t.code);
  const needsFallback=!primary.status||primary.status>=400||primary.exactImages.length===0||!primary.text.toLowerCase().includes(t.code.toLowerCase());
  const fallback=needsFallback?await probe(browser,t.fallback,t.code):null;
  results.push({code:t.code,primary:{...primary,html:undefined},fallback:fallback?{...fallback,html:undefined}:null,needsFallback});
  fs.writeFileSync(`probe-${t.code.toLowerCase()}-primary.html`,primary.html||''); if(fallback)fs.writeFileSync(`probe-${t.code.toLowerCase()}-fallback.html`,fallback.html||'');
 }
 await browser.close(); fs.writeFileSync('demo-image-probe.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results.map(x=>({code:x.code,primaryStatus:x.primary.status,primaryTitle:x.primary.title,primaryExact:x.primary.exactImages,needsFallback:x.needsFallback,fallbackStatus:x.fallback&&x.fallback.status,fallbackExact:x.fallback&&x.fallback.exactImages})),null,2));
})().catch(e=>{console.error(e);process.exit(1)});
