// 新着記事をBlueskyに自動投稿する (GitHub Actionsから呼ばれる)
// 使い方: node scripts/post-bluesky.mjs articles/2026-07-22-daily.md
// 必要な環境変数: BLUESKY_HANDLE (例: ainews.bsky.social), BLUESKY_APP_PASSWORD (アプリパスワード)
// 未設定なら何もせず正常終了する。
import { readFileSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const HANDLE = process.env.BLUESKY_HANDLE;
const APP_PASSWORD = process.env.BLUESKY_APP_PASSWORD;
if (!HANDLE || !APP_PASSWORD) {
  console.log('BLUESKY_HANDLE / BLUESKY_APP_PASSWORD 未設定のため投稿をスキップします');
  process.exit(0);
}

const mdPath = process.argv[2];
if (!mdPath) { console.error('記事ファイルを指定してください'); process.exit(1); }

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = JSON.parse(readFileSync(join(ROOT, 'config', 'site.json'), 'utf8'));
const raw = readFileSync(join(ROOT, mdPath), 'utf8');
const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
const meta = {};
if (fm) for (const line of fm[1].split(/\r?\n/)) {
  const i = line.indexOf(':');
  if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
}

const slug = basename(mdPath).replace(/\.md$/, '');
const url = `${site.url}/${slug}.html`;
const title = meta.title || slug;
let desc = meta.description || '';

// Blueskyは300グラフェム制限。全体が280に収まるよう説明文を切り詰める
const fixed = `【${title}】\n\n\n#AIニュース\n${url}`.length;
const maxDesc = Math.max(0, 280 - fixed);
if (desc.length > maxDesc) desc = desc.slice(0, Math.max(0, maxDesc - 1)) + '…';
const text = `【${title}】\n\n${desc}\n#AIニュース\n${url}`;

// リンクとハッシュタグをリッチテキスト(facet)にする
const enc = new TextEncoder();
const byteIndex = (sub) => {
  const at = text.indexOf(sub);
  return { byteStart: enc.encode(text.slice(0, at)).length, byteEnd: enc.encode(text.slice(0, at)).length + enc.encode(sub).length };
};
const facets = [
  { index: byteIndex(url), features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }] },
  { index: byteIndex('#AIニュース'), features: [{ $type: 'app.bsky.richtext.facet#tag', tag: 'AIニュース' }] },
];

const api = 'https://bsky.social/xrpc';
const session = await fetch(`${api}/com.atproto.server.createSession`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ identifier: HANDLE, password: APP_PASSWORD }),
}).then(r => { if (!r.ok) throw new Error(`ログイン失敗: ${r.status}`); return r.json(); });

const res = await fetch(`${api}/com.atproto.repo.createRecord`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', authorization: `Bearer ${session.accessJwt}` },
  body: JSON.stringify({
    repo: session.did,
    collection: 'app.bsky.feed.post',
    record: {
      $type: 'app.bsky.feed.post',
      text,
      facets,
      langs: ['ja'],
      createdAt: new Date().toISOString(),
    },
  }),
}).then(r => { if (!r.ok) throw new Error(`投稿失敗: ${r.status}`); return r.json(); });

console.log(`✅ Blueskyに投稿しました: ${res.uri}`);
