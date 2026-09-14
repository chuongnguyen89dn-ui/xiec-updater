const { chromium } = require('playwright');

const SOURCE_URL = process.env.SOURCE_URL || 'https://vlxx.phd/';
const TARGET_REPO = process.env.TARGET_REPO || 'chuongnguyen89dn-ui/xiec';
const TARGET_PATH = process.env.TARGET_PATH || 'data/ket_qua_1500_phim.json';
const TOKEN = process.env.XIEC_TOKEN;
const START_PAGE = Number(process.env.START_PAGE || 1);
const MAX_PAGE = Number(process.env.MAX_PAGE || 3);
const CONCURRENCY = Number(process.env.FAST_CONCURRENCY || 6);
const ENRICH_RECENT = Number(process.env.ENRICH_RECENT || 5);
if (!TOKEN) throw new Error('Missing XIEC_TOKEN');

const H={Authorization:`Bearer ${TOKEN}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'xiec-fast-full-scan'};
async function readTarget(){const r=await fetch(`https://api.github.com/repos/${TARGET_REPO}/contents/${TARGET_PATH}`,{headers:H});if(!r.ok)throw new Error(`read ${r.status} ${await r.text()}`);const d=await r.json();let e=d.content||'';if(!e){const b=await fetch(`https://api.github.com/repos/${TARGET_REPO}/git/blobs/${d.sha}`,{headers:H});if(!b.ok)throw new Error(`blob ${b.status}`);e=(await b.json()).content||'';}return{sha:d.sha,movies:JSON.parse(Buffer.from(e.replace(/\n/g,''),'base64').toString('utf8'))};}
async function writeTarget(sha,movies,message){const r=await fetch(`https://api.github.com/repos/${TARGET_REPO}/contents/${TARGET_PATH}`,{method:'PUT',headers:{...H,'Content-Type':'application/json'},body:JSON.stringify({message,content:Buffer.from(JSON.stringify(movies,null,2)).toString('base64'),sha,branch:'main'})});if(!r.ok)throw new Error(`write ${r.status} ${await r.text()}`);}
const norm=u=>{try{const x=new URL(u,SOURCE_URL);x.hash='';x.search='';return x.href}catch{return u||''}};
const pageId=u=>(u.match(/\/(\d+)\/?(?:\?.*)?$/)||[])[1]||'';
const text=v=>String(v||'').replace(/\s+/g,' ').trim();
function extractFile(html){const src=html.match(/window\.__SRC\s*=\s*(\[[\s\S]*?\])\s*;/i);if(src){try{const arr=JSON.parse(src[1]);const f=arr?.find(x=>x&&typeof x.file==='string')?.file;if(f)return f}catch{}}const m=html.match(/["']file["']\s*:\s*["'](https?:\/\/[^"']+)["']/i)||html.match(/file\s*:\s*["'](https?:\/\/[^"']+)["']/i);return m?m[1].replace(/\\\//g,'/').replace(/&amp;/g,'&'):'';}
async function embedFile(embed){if(!embed)return'';const r=await fetch(embed,{headers:{'User-Agent':'Mozilla/5.0','Referer':SOURCE_URL},redirect:'follow'});if(!r.ok)return'';return extractFile(await r.text());}

async function pageCards(page){
  const rows=await page.evaluate(()=>{
    const clean=s=>(s||'').replace(/\s+/g,' ').trim();
    const anchors=[...document.querySelectorAll('a[href]')].filter(a=>/\/video\/[^/]+\/\d+\/?(?:[?#].*)?$/i.test(a.href));
    const out=[];
    for(const a of anchors){
      const url=a.href;
      if(out.some(x=>x.url===url))continue;
      const card=a.closest('article,.video-item,.movie-item,.item,.post,.thumb-item,.video,.film-item,.col')||a.parentElement;
      let vietsub=false;
      if(card){
        const badges=[...card.querySelectorAll('span,small,[class*="badge"],[class*="tag"],[class*="label"],[class*="quality"]')];
        vietsub=badges.some(x=>/^viet\s*sub$/i.test(clean(x.textContent)))||!!card.querySelector('img[alt*="vietsub" i],img[title*="vietsub" i]');
      }
      out.push({url,vietsub});
    }
    return out;
  });
  return rows.map(x=>({url:norm(x.url),vietsub:!!x.vietsub}));
}
async function clickPage(page,nextNo){const sels=[`a:visible:text-is("${nextNo}")`,`.pagination a:visible:text-is("${nextNo}")`,`.page-numbers:visible:text-is("${nextNo}")`,`a[rel="next"]:visible`];for(const sel of sels){const loc=page.locator(sel).first();if(await loc.count().catch(()=>0)){const before=page.url();try{await loc.click({timeout:10000});await page.waitForLoadState('domcontentloaded',{timeout:15000}).catch(()=>{});await page.waitForTimeout(700);console.log(`FAST_PAGER ${before} -> ${page.url()}`);return true}catch{}}}return false;}
async function discover(browser,existing){
  const ctx=await browser.newContext({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36',viewport:{width:1365,height:900}});
  const page=await ctx.newPage();
  await page.route('**/*',r=>['image','font','media'].includes(r.request().resourceType())?r.abort():r.continue());
  await page.goto(SOURCE_URL,{waitUntil:'domcontentloaded',timeout:45000});
  const fresh=[],seen=new Set(),recent=[];
  for(let p=1;p<=MAX_PAGE;p++){
    await page.waitForTimeout(500);
    const cards=await pageCards(page);
    for(const item of cards){
      if(!recent.some(x=>x.url===item.url)&&recent.length<ENRICH_RECENT)recent.push(item);
      if(!existing.has(item.url)&&!seen.has(item.url)){fresh.push(item);seen.add(item.url);}
    }
    console.log(`FAST_PAGE page=${p} links=${cards.length} new=${cards.filter(x=>!existing.has(x.url)).length} url=${page.url()}`);
    if(p>=MAX_PAGE||!(await clickPage(page,p+1)))break;
  }
  await ctx.close();
  return{fresh,recent};
}

function parseLabel(body,label,nextLabels){
  const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const next=nextLabels.map(x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|');
  const re=new RegExp(`${escaped}\\s*:\\s*(.*?)(?=\\s+(?:${next})\\s*:|$)`,'i');
  return text((body.match(re)||[])[1]||'');
}
function parseMetaLabels(body){
  const labels=['Mã phim','Ma phim','Diễn viên','Dien vien','Quốc gia','Quoc gia','Thời lượng','Thoi luong','Thể loại','The loai'];
  const get=(names)=>{for(const n of names){const v=parseLabel(body,n,labels.filter(x=>x!==n));if(v)return v;}return'';};
  const code=get(['Mã phim','Ma phim']).split(' ')[0];
  const actorText=get(['Diễn viên','Dien vien']);
  const actors=actorText?actorText.split(/[,|]/).map(text).filter(Boolean):[];
  const country=get(['Quốc gia','Quoc gia']);
  const runtime=get(['Thời lượng','Thoi luong']);
  return{code,actors,country,runtime};
}

async function extractMovie(browser,item,index,total){
  const url=typeof item==='string'?item:item.url;
  const listingVietsub=typeof item==='object'&&item.vietsub===true;
  const ctx=await browser.newContext({userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/140 Safari/537.36',viewport:{width:1280,height:720}});
  const p=await ctx.newPage();let s1='',s2='';
  const cap=u=>{if(/play\.vlstream\.net\/embed\/.*\/s1/i.test(u))s1=u;if(/play\.vlstream\.net\/embed\/.*\/s2/i.test(u))s2=u;};
  p.on('request',r=>cap(r.url()));p.on('response',r=>cap(r.url()));
  try{
    await p.route('**/*',r=>['image','font','stylesheet'].includes(r.request().resourceType())?r.abort():r.continue());
    await p.goto(url,{waitUntil:'domcontentloaded',timeout:30000});await p.waitForTimeout(500);
    if(!s1)s1=p.frames().map(f=>f.url()).find(u=>/play\.vlstream\.net\/embed\/.*\/s1/i.test(u))||'';
    const meta=await p.evaluate(()=>{
      const txt=s=>(s||'').replace(/\s+/g,' ').trim();
      const title=txt(document.querySelector('h1')?.textContent)||txt(document.querySelector('meta[property="og:title"]')?.content)||txt(document.title);
      const poster=document.querySelector('meta[property="og:image"]')?.content||'';
      const preferred=document.querySelector('[itemprop="description"],.video-description,.description,.entry-description,.post-description');
      const description=txt(preferred?.textContent)||txt(document.querySelector('meta[property="og:description"]')?.content)||txt(document.querySelector('meta[name="description"]')?.content)||'';
      const body=txt(document.body?.innerText||'');
      return{title,poster,description,body};
    }).catch(()=>({}));
    for(const f of p.frames()){
      const ok=await f.evaluate(()=>{const c=s=>(s||'').replace(/\s+/g,' ').trim();const e=[...document.querySelectorAll('[onclick],button,a,li,[role=button]')].find(x=>c(x.textContent)==='#2');if(!e)return false;e.click();return true}).catch(()=>false);
      if(ok)break;
    }
    for(let i=0;i<12&&!s2;i++){await p.waitForTimeout(180);s2=p.frames().map(f=>f.url()).find(u=>/play\.vlstream\.net\/embed\/.*\/s2/i.test(u))||s2;}
    const[file1,file2]=await Promise.all([embedFile(s1),embedFile(s2)]);
    const id=pageId(url),streams=[];
    if(file1&&/\/manifest-s1\//i.test(file1))streams.push({name:'#1',url:file1});
    if(file2&&/\/manifest-s2\//i.test(file2))streams.push({name:'#2',url:file2});
    const labels=parseMetaLabels(meta.body||'');
    console.log(`FAST_MOVIE ${index+1}/${total} id=${id} vietsub=${listingVietsub?'yes':'no'} code=${labels.code||'-'} actors=${labels.actors.length} s1=${streams.some(x=>x.name==='#1')?'ok':'miss'} s2=${streams.some(x=>x.name==='#2')?'ok':'miss'}`);
    return{
      id:`movie_${id}`,
      title:meta.title||`movie_${id}`,
      poster:meta.poster||'',
      description:meta.description||'',
      page_url:url,
      vietsub:listingVietsub,
      code:labels.code||'',
      actors:labels.actors,
      country:labels.country||'',
      runtime:labels.runtime||'',
      manifest_url:file1||'',
      manifest_detected_by:file1?'direct_s1':'',
      mp4_url:'',
      status:file1?'manifest_found':(file2?'stream2_only':'metadata_only'),
      streams
    };
  }catch(e){console.log(`FAST_ERR ${index+1}/${total} url=${url} ${e.message}`);return null}
  finally{await ctx.close().catch(()=>{})}
}

function mergeRecord(old,item){
  if(!item)return old;
  const out={...old};
  for(const k of ['title','poster','description','code','country','runtime'])if(item[k])out[k]=item[k];
  if(item.actors?.length)out.actors=item.actors;
  if(item.vietsub===true)out.vietsub=true;
  if(item.streams?.length){out.streams=item.streams;if(item.manifest_url)out.manifest_url=item.manifest_url;if(item.manifest_detected_by)out.manifest_detected_by=item.manifest_detected_by;out.status=item.status;}
  out.page_url=item.page_url||old.page_url;
  return out;
}

(async()=>{
  let{sha,movies}=await readTarget();
  const existing=new Set(movies.map(m=>norm(m.page_url)).filter(Boolean));
  console.log(`FAST_START existing=${movies.length} start_page=${START_PAGE} concurrency=${CONCURRENCY} enrich_recent=${ENRICH_RECENT}`);
  const browser=await chromium.launch({headless:true});
  const{fresh,recent}=await discover(browser,existing);
  console.log(`FAST_DISCOVERY new_movies=${fresh.length} recent_to_enrich=${recent.length}`);

  let changed=false;
  if(recent.length){
    for(let i=0;i<recent.length;i++){
      const item=await extractMovie(browser,recent[i],i,recent.length);
      if(!item)continue;
      const idx=movies.findIndex(m=>norm(m.page_url)===norm(item.page_url));
      if(idx>=0){movies[idx]=mergeRecord(movies[idx],item);changed=true;console.log(`FAST_ENRICH ${i+1}/${recent.length} id=${pageId(item.page_url)}`);}
    }
  }

  const added=[];
  if(fresh.length){
    let cursor=0,done=0,ok=0;
    async function worker(){while(true){const n=cursor++;if(n>=fresh.length)return;const item=await extractMovie(browser,fresh[n],n,fresh.length);done++;if(item&&item.streams.length){added.push(item);ok++;}if(done%10===0||done===fresh.length)console.log(`FAST_PROGRESS processed=${done}/${fresh.length} success=${ok} failed=${done-ok}`)}}
    await Promise.all(Array.from({length:Math.min(CONCURRENCY,fresh.length)},worker));
  }
  await browser.close();

  if(added.length){added.sort((a,b)=>Number(pageId(b.page_url))-Number(pageId(a.page_url)));movies=[...added,...movies];changed=true;}
  if(!changed){console.log('FAST_DONE no_changes');return;}
  await writeTarget(sha,movies,`Homepage update: +${added.length} new; enriched ${recent.length} recent movies`);
  console.log(`FAST_DONE added=${added.length} enriched=${recent.length} total=${movies.length}`);
})().catch(e=>{console.error('FAST_FATAL',e);process.exit(1)});
