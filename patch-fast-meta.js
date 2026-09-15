const fs = require('fs');
const file = 'fast-full-scan.js';
let s = fs.readFileSync(file, 'utf8');

const old = `      const actors=uniq(links.filter(x=>/\\/(dien-vien|dienvien|actor|actors)\\//i.test(x.href)).map(x=>x.text));
      const countries=uniq(links.filter(x=>/\\/(quoc-gia|quocgia|country)\\//i.test(x.href)).map(x=>x.text));
      const genres=uniq(links.filter(x=>/\\/(vietsub|khong-che|hoc-sinh|vung-trom|cap-3|chau-au|phim-sex-hay)\\/?/i.test(x.href)).map(x=>x.text));`;

const replacement = `      // Current source detail DOM: use the same selectors already verified by backfill-v3.
      const actressBox=document.querySelector('.actress-tag');
      const categoryBox=document.querySelector('.category-tag');
      const actors=actressBox?uniq([...actressBox.querySelectorAll('a')].map(a=>a.textContent).concat(actressBox.querySelectorAll('a').length?[]:[actressBox.textContent])):uniq(links.filter(x=>/\\/(dien-vien|dienvien|actor|actors)\\//i.test(x.href)).map(x=>x.text));
      const countries=uniq(links.filter(x=>/\\/(quoc-gia|quocgia|country)\\//i.test(x.href)).map(x=>x.text));
      const genres=categoryBox?uniq([...categoryBox.querySelectorAll('a')].map(a=>a.textContent).concat(categoryBox.querySelectorAll('a').length?[]:[categoryBox.textContent])):uniq(links.filter(x=>/\\/(vietsub|khong-che|hoc-sinh|vung-trom|cap-3|chau-au|phim-sex-hay)\\/?/i.test(x.href)).map(x=>x.text));`;

if (!s.includes(old)) throw new Error('FAST_META_PATCH anchor 1 not found');
s = s.replace(old, replacement);

const oldCode = `      const code=(labelText.match(/(?:Mã\\s*phim|Ma\\s*phim)\\s*:?\\s*([A-Z0-9][A-Z0-9._-]{2,})/i)||body.match(/(?:Mã\\s*phim|Ma\\s*phim)\\s*:?\\s*([A-Z0-9][A-Z0-9._-]{2,})/i)||[])[1]||'';`;
const newCode = `      const directCode=txt(document.querySelector('.video-code')?.textContent||'').replace(/^(?:Mã\\s*phim|Ma\\s*phim)\\s*[:：]?\\s*/i,'');
      const code=directCode||(labelText.match(/(?:Mã\\s*phim|Ma\\s*phim)\\s*:?\\s*([A-Z0-9][A-Z0-9._-]{2,})/i)||body.match(/(?:Mã\\s*phim|Ma\\s*phim)\\s*:?\\s*([A-Z0-9][A-Z0-9._-]{2,})/i)||[])[1]||'';`;
if (!s.includes(oldCode)) throw new Error('FAST_META_PATCH anchor 2 not found');
s = s.replace(oldCode, newCode);

// Preserve genres so the addon can render new records exactly like existing records.
s = s.replace(`      actors,\n      country,`, `      actors,\n      genres:meta.genres||[],\n      country,`);
s = s.replace(`  if(item.actors?.length)out.actors=item.actors;`, `  if(item.actors?.length)out.actors=item.actors;\n  if(item.genres?.length)out.genres=item.genres;`);

fs.writeFileSync(file, s);
console.log('FAST_META_PATCHED');
