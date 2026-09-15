const { chromium } = require('playwright');
const fs = require('fs');

const targets = [
  { code:'SNOS-357', source:'JapanSM', url:'https://www.japansm.com/product/snos-357/' },
  { code:'MIKR-084', source:'JavSubtitled', url:'https://javsubtitled.com/movie/mikr00084' }
];
const isImage = u => /\.(?:jpe?g|png|webp)(?:\?|$)/i.test(u||'');
const uniq = a => [...new Set(a.filter(Boolean))];

(async()=>{
 const browser=await chromium.launch({headless:true});
 const results=[];
 for(const t of targets){
   const page=await browser.newPage({viewport:{width:1440,height:1000}});
   const responses=[];
   page.on('response',r=>{ const u=r.url(); if(isImage(u)) responses.push(u); });
   let status=null,error=null,title='';
   try{
     const r=await page.goto(t.url,{waitUntil:'domcontentloaded',timeout:60000}); status=r&&r.status();
     await page.waitForTimeout(7000); title=await page.title();
     const dom=await page.evaluate(()=>{
       const out=[];
       for(const el of document.querySelectorAll('img,source,a')){
         for(const k of ['src','data-src','data-lazy-src','srcset','data-srcset','href']){
           const v=el.getAttribute(k); if(!v)continue;
           for(const p of v.split(',').map(x=>x.trim().split(/\s+/)[0])){
             try{out.push(new URL(p,location.href).href)}catch{}
           }
         }
       }
       return out;
     });
     const images=uniq([...responses,...dom]).filter(isImage);
     const exact=images.filter(u=>u.toLowerCase().replace(/[^a-z0-9]/g,'').includes(t.code.toLowerCase().replace(/[^a-z0-9]/g,'')) || (t.code==='MIKR-084' && /mikr0*084/i.test(u)));
     results.push({...t,status,title,imageCount:images.length,exactImages:exact,images});
     fs.writeFileSync(`probe-${t.code.toLowerCase()}.html`,await page.content());
   }catch(e){error=String(e);results.push({...t,status,title,error,imageCount:0,exactImages:[],images:[]});}
   await page.close();
 }
 await browser.close();
 fs.writeFileSync('demo-image-probe.json',JSON.stringify(results,null,2));
 console.log(JSON.stringify(results.map(x=>({code:x.code,source:x.source,status:x.status,title:x.title,imageCount:x.imageCount,exactImages:x.exactImages})),null,2));
})().catch(e=>{console.error(e);process.exit(1)});
