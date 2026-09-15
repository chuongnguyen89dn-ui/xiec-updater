const OWNER_REPO = process.env.TARGET_REPO || 'chuongnguyen89dn-ui/xiec';
const TARGET_PATH = process.env.TARGET_PATH || 'data/ket_qua_1500_phim.json';
const TOKEN = process.env.XIEC_TOKEN;
if (!TOKEN) throw new Error('XIEC_TOKEN missing');

const api = `https://api.github.com/repos/${OWNER_REPO}/contents/${TARGET_PATH}`;
const headers = {
  Authorization: `Bearer ${TOKEN}`,
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'xiec-updater'
};

async function main() {
  const r = await fetch(api, { headers });
  if (!r.ok) throw new Error(`fetch target: ${r.status} ${await r.text()}`);
  const f = await r.json();
  const movies = JSON.parse(Buffer.from(f.content, 'base64').toString('utf8'));

  const patches = {
    'SNOS-357': {
      releaseInfo: '2026-08-07',
      year: '2026',
      runtime: '1 giờ 58 phút',
      director: ['Inaball'],
      actors: ['Niko Kawagoe'],
      metadata_sources: ['Subtitle Nexus'],
      metadata_verified: true
    },
    'MIKR-084': {
      releaseInfo: '2026-04-17',
      year: '2026',
      studio: 'MOODYZ',
      maker: 'MOODYZ',
      actors: ['Takashi Haneda', 'Aki Sasaki'],
      metadata_sources: ['SubtitleTrans', 'Manko user-verified'],
      metadata_verified: true
    }
  };

  let changed = 0;
  for (const m of movies) {
    const p = patches[String(m.code || '').toUpperCase()];
    if (!p) continue;
    for (const [k, v] of Object.entries(p)) {
      if (k === 'actors') {
        const old = Array.isArray(m.actors) ? m.actors : [];
        const merged = [...new Set([...old, ...v])];
        if (JSON.stringify(old) !== JSON.stringify(merged)) { m.actors = merged; changed++; }
      } else if ((m[k] === undefined || m[k] === null || m[k] === '') && v !== '') {
        m[k] = v; changed++;
      } else if (['metadata_sources','metadata_verified','releaseInfo','year','director','studio','maker'].includes(k)) {
        if (JSON.stringify(m[k]) !== JSON.stringify(v)) { m[k] = v; changed++; }
      }
    }
  }

  if (!changed) { console.log('No metadata changes needed'); return; }
  const content = Buffer.from(JSON.stringify(movies, null, 2) + '\n').toString('base64');
  const u = await fetch(api, {
    method: 'PUT', headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: 'Enrich metadata for SNOS-357 and MIKR-084',
      content,
      sha: f.sha,
      branch: 'main'
    })
  });
  if (!u.ok) throw new Error(`update target: ${u.status} ${await u.text()}`);
  const out = await u.json();
  console.log('Updated two latest movie records:', out.commit && out.commit.sha, 'field changes:', changed);
}

main().catch(e => { console.error(e); process.exit(1); });
