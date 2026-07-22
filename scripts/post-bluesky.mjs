// 新着記事をBlueskyに自動投稿する (ローカルのスケジュール実行から呼ばれる)
// 使い方: node scripts/post-bluesky.mjs articles/2026-07-23-daily.md
//         node scripts/post-bluesky.mjs --delete <rkey>   … 投稿の削除(緊急用)
// 認証情報は .secrets.json の bluesky.handle / bluesky.appPassword を読む
// (環境変数 BLUESKY_HANDLE / BLUESKY_APP_PASSWORD があればそちらを優先)。
// 未設定なら何もせず正常終了する。
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SECRETS_PATH = join(ROOT, '.secrets.json');

let HANDLE = process.env.BLUESKY_HANDLE;
let APP_PASSWORD = process.env.BLUESKY_APP_PASSWORD;
if ((!HANDLE || !APP_PASSWORD) && existsSync(SECRETS_PATH)) {
  const s = JSON.parse(readFileSync(SECRETS_PATH, 'utf8')).bluesky || {};
  HANDLE = HANDLE || s.handle;
  APP_PASSWORD = APP_PASSWORD || s.appPassword;
}
if (!HANDLE || !APP_PASSWORD || /ここに/.test(String(APP_PASSWORD))) {
  console.log('Bluesky認証情報が未設定のため投稿をスキップします');
  process.exit(0);
}

const api = 'https://bsky.social/xrpc';
const session = await fetch(`${api}/com.atproto.server.createSession`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ identifier: HANDLE, password: APP_PASSWORD }),
}).then(r => { if (!r.ok) throw new Error(`ログイン失敗: ${r.status}`); return r.json(); });

// ---- 削除モード ----
if (process.argv[2] === '--delete') {
  const rkey = process.argv[3];
  if (!rkey) { console.error('rkeyを指定してください'); process.exit(1); }
  const res = await fetch(`${api}/com.atproto.repo.deleteRecord`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${session.accessJwt}` },
    body: JSON.stringify({ repo: session.did, collection: 'app.bsky.feed.post', rkey }),
  });
  if (!res.ok) throw new Error(`削除失敗: ${res.status}`);
  console.log(`✅ 投稿 ${rkey} を削除しました`);
  process.exit(0);
}

// ---- 投稿モード ----
const mdPath = process.argv[2];
if (!mdPath) { console.error('記事ファイルを指定してください'); process.exit(1); }

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

const rkey = res.uri.split('/').pop();
console.log(`✅ Blueskyに投稿しました: https://bsky.app/profile/${HANDLE}/post/${rkey}`);
