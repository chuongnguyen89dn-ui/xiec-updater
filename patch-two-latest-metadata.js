const OWNER_REPO = process.env.TARGET_REPO || 'chuongnguyen89dn-ui/xiec';
const TARGET_PATH = process.env.TARGET_PATH || 'data/ket_qua_1500_phim.json';
const TOKEN = process.env.XIEC_TOKEN;
if (!TOKEN) throw new Error('XIEC_TOKEN missing');

const api = `https://api.github.com/repos/${OWNER_REPO}/contents/${TARGET_PATH}`;
const headers = { Authorization: `Bearer ${TOKEN}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'xiec-updater' };
async function getLargeFile(f) {
  if (f.content) return Buffer.from(f.content, 'base64').toString('utf8');
  const br = await fetch(`https://api.github.com/repos/${OWNER_REPO}/git/blobs/${f.sha}`, { headers });
  if (!br.ok) throw new Error(`fetch blob: ${br.status} ${await br.text()}`);
  const b = await br.json(); return Buffer.from(b.content.replace(/\n/g,''), 'base64').toString('utf8');
}
async function main() {
  const r = await fetch(api,{headers}); if(!r.ok) throw new Error(`fetch target: ${r.status} ${await r.text()}`);
  const f=await r.json(), movies=JSON.parse(await getLargeFile(f));
  const patches={
    'SNOS-357':{
      releaseInfo:'2026-08-07',year:'2026',runtime:'1 giờ 58 phút',director:['Inaball'],actors:['Niko Kawagoe'],
      actor_photos:{'Niko Kawagoe':'https://commons.wikimedia.org/wiki/Special:Redirect/file/Niko-Kawagoe-Chef---2025-12-24_056.jpg'},
      preview:'https://www.japansm.com/wp-content/uploads/2026/08/snos-357-preview.webp',
      snapshots:['https://www.japansm.com/wp-content/uploads/2026/08/snos-357-preview.webp'],
      cover_source:'https://www.japansm.com/wp-content/uploads/2026/08/SNOS-357.webp',
      metadata_sources:['Subtitle Nexus','JapanSM','Wikimedia Commons'],metadata_verified:true
    },
    'MIKR-084':{
      releaseInfo:'2026-04-17',year:'2026',studio:'MOODYZ',maker:'MOODYZ',actors:['Takashi Haneda','Aki Sasaki'],
      actor_photos:{'Aki Sasaki':'https://ixocdn.com/actors/69e11b2fba8a6d0a3c00b2dc/1766031918934_AkiSasaki.jpg'},
      metadata_sources:['SubtitleTrans','Manko'],metadata_verified:true
    }
  };
  let changed=0;
  for(const m of movies){const p=patches[String(m.code||'').toUpperCase()];if(!p)continue;
    for(const[k,v]of Object.entries(p)){
      if(k==='actors'){const old=Array.isArray(m.actors)?m.actors:[],merged=[...new Set([...old,...v])];if(JSON.stringify(old)!==JSON.stringify(merged)){m.actors=merged;changed++;}}
      else if(k==='actor_photos'){const merged={...(m.actor_photos||{}),...v};if(JSON.stringify(m.actor_photos||{})!==JSON.stringify(merged)){m.actor_photos=merged;changed++;}}
      else if(['metadata_sources','metadata_verified','releaseInfo','year','director','studio','maker','preview','snapshots','cover_source'].includes(k)){if(JSON.stringify(m[k])!==JSON.stringify(v)){m[k]=v;changed++;}}
      else if((m[k]===undefined||m[k]===null||m[k]==='')&&v!==''){m[k]=v;changed++;}
    }
  }
  if(!changed){console.log('No metadata changes needed');return;}
  const content=Buffer.from(JSON.stringify(movies,null,2)+'\n').toString('base64');
  const u=await fetch(api,{method:'PUT',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({message:'Complete metadata for SNOS-357 and MIKR-084',content,sha:f.sha,branch:'main'})});
  if(!u.ok)throw new Error(`update target: ${u.status} ${await u.text()}`);
  const out=await u.json();console.log('Updated:',out.commit&&out.commit.sha,'field changes:',changed);
}
main().catch(e=>{console.error(e);process.exit(1);});
