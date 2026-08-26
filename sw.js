// バージョンを上げると、古いキャッシュが自動的に破棄され、
// ブラウザが新しいindex.html等を取得し直します。
// 今後アプリを更新するたびに、この数字を1つ増やしてください。
const SW_VERSION = 6;
const CACHE = `enya-stats-v${SW_VERSION}`;

const PRECACHE = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "https://unpkg.com/react@18/umd/react.production.min.js",
  "https://unpkg.com/react-dom@18/umd/react-dom.production.min.js",
  "https://unpkg.com/papaparse@5.4.1/papaparse.min.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()) // 新しいSWをすぐ有効化
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()) // 開いているタブにもすぐ適用
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // Supabase APIは常に最新を取りに行く（キャッシュしない）
  if (url.hostname.includes("supabase")) return;

  // index.html / ルートは「まずネットワーク、失敗したらキャッシュ」
  // → デプロイ後すぐ新しい内容が見える
  const isHTML = e.request.mode === "navigate" || url.pathname.endsWith("index.html") || url.pathname === "/" || url.pathname.endsWith("/enya-stats/");
  if (isHTML) {
    e.respondWith(
      fetch(e.request).then((res) => {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
        return res;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // それ以外（ライブラリ等）は従来通りキャッシュ優先
  e.respondWith(
    caches.match(e.request).then((r) => r || fetch(e.request).then((res) => {
      if (res.ok && e.request.method === "GET") {
        const clone = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone));
      }
      return res;
    }))
  );
});
