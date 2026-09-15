const fs = require('fs');
const file = 'fast-full-scan.js';
let s = fs.readFileSync(file, 'utf8');

const old = `      const actors=uniq(links.filter(x=>/\\/(dien-vien|dienvien|actor|actors)\\//i.test(x.href)).map(x=>x.text));
      const countries=uniq(links.filter(x=>/\\/(quoc-gia|quocgia|country)\\//i.test(x.href)).map(x=>x.text));
      const genres=uniq(links.filter(x=>/\\/(vietsub|khong-che|hoc-sinh|vung-trom|cap-3|chau-au|phim-sex-hay)\\/?/i.test(x.href)).map(x=>x.text));`;

const replacement = `      // Use the same real DOM selectors and info-row parsing as the old working backfill-v3.
      const actressBox=document.querySelector('.actress-tag');
      const categoryBox=document.querySelector('.category-tag');
      const actors=actressBox?uniq([...actressBox.querySelectorAll('a')].map(a=>a.textContent).concat(actressBox.querySelectorAll('a').length?[]:[actressBox.textContent])):uniq(links.filter(x=>/\\/(dien-vien|dienvien|actor|actors)\\//i.test(x.href)).map(x=>x.text));
      const countries=uniq(links.filter(x=>/\\/(quoc-gia|quocgia|country)\\//i.test(x.href)).map(x=>x.text));
      const genres=categoryBox?uniq([...categoryBox.querySelectorAll('a')].map(a=>a.textContent).concat(categoryBox.querySelectorAll('a').length?[]:[categoryBox.textContent])):uniq(links.filter(x=>/\\/(vietsub|khong-che|hoc-sinh|vung-trom|cap-3|chau-au|phim-sex-hay)\\/?/i.test(x.href)).map(x=>x.text));
      const info={};
      for(const el of [...document.querySelectorAll('tr,li,div,p,span')]){
        const t=txt(el.innerText||el.textContent||'');
        if(!t||t.length>180)continue;
        const m=t.match(/^(Năm|Year|Thời lượng|Runtime|Quốc gia|Country|Studio|Hãng)\\s*[:：]\\s*(.+)$/i);
        if(m)info[m[1].toLowerCase()]=txt(m[2]);
      }`;

if (!s.includes(old)) throw new Error('FAST_META_PATCH anchor 1 not found');
s = s.replace(old, replacement);

const oldCode = `      const code=(labelText.match(/(?:Mã\\s*phim|Ma\\s*phim)\\s*:?\\s*([A-Z0-9][A-Z0-9._-]{2,})/i)||body.match(/(?:Mã\\s*phim|Ma\\s*phim)\\s*:?\\s*([A-Z0-9][A-Z0-9._-]{2,})/i)||[])[1]||'';`;
const newCode = `      const directCode=txt(document.querySelector('.video-code')?.textContent||'').replace(/^(?:Mã\\s*phim|Ma\\s*phim)\\s*[:：]?\\s*/i,'');
      const code=directCode||(labelText.match(/(?:Mã\\s*phim|Ma\\s*phim)\\s*:?\\s*([A-Z0-9][A-Z0-9._-]{2,})/i)||body.match(/(?:Mã\\s*phim|Ma\\s*phim)\\s*:?\\s*([A-Z0-9][A-Z0-9._-]{2,})/i)||[])[1]||'';`;
if (!s.includes(oldCode)) throw new Error('FAST_META_PATCH anchor 2 not found');
s = s.replace(oldCode, newCode);

const oldRuntime = `      const runtime=(labelText.match(/(?:Thời\\s*lượng|Thoi\\s*luong)\\s*:?\\s*([^|]+)/i)||body.match(/(?:Thời\\s*lượng|Thoi\\s*luong)\\s*:?\\s*([0-9]{1,3}\\s*(?:phút|phut|minutes?|mins?))/i)||[])[1]||'';`;
const newRuntime = `      const runtime=info['thời lượng']||info['runtime']||(labelText.match(/(?:Thời\\s*lượng|Thoi\\s*luong)\\s*:?\\s*([^|]+)/i)||body.match(/(?:Thời\\s*lượng|Thoi\\s*luong)\\s*:?\\s*([0-9]{1,3}\\s*(?:phút|phut|minutes?|mins?))/i)||[])[1]||'';`;
if (!s.includes(oldRuntime)) throw new Error('FAST_META_PATCH runtime anchor not found');
s = s.replace(oldRuntime, newRuntime);

// Preserve genres so the addon can render new records exactly like existing records.
s = s.replace(`      actors,\n      country,`, `      actors,\n      genres:meta.genres||[],\n      country,`);
s = s.replace(`  if(item.actors?.length)out.actors=item.actors;`, `  if(item.actors?.length)out.actors=item.actors;\n  if(item.genres?.length)out.genres=item.genres;`);

fs.writeFileSync(file, s);
console.log('FAST_META_PATCHED_LEGACY_INFO_RUNTIME');
