/**
 * sw.js — TodoApp 离线 Service Worker（移动 PWA 专用；Tauri 桌面端不注册）
 *
 * 策略：
 *  - 导航请求（HTML）：network-first，离线回退缓存 → 断网也能打开 App
 *  - 静态资源（/assets/ 带 hash、字体、图标）：cache-first，命中即返回
 *  - 其余同源 GET：stale-while-revalidate
 * Vite 资源带内容 hash，cache-first 永不脏读；版本号变更时旧缓存整体清除。
 */
const CACHE = 'todoapp-v1';
const APP_SHELL = ['/', '/manifest.webmanifest', '/icons/icon-192.png', '/icons/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // 导航：network-first（保证拿到最新 index.html），离线回退缓存
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put('/', copy));
          return res;
        })
        .catch(() => caches.match('/'))
    );
    return;
  }

  // 带 hash 的静态资源与字体/图标：cache-first
  const isStatic = url.pathname.startsWith('/assets/')
    || url.pathname.startsWith('/fonts/')
    || url.pathname.startsWith('/icons/');
  if (isStatic) {
    event.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      }))
    );
    return;
  }

  // 其余同源 GET：stale-while-revalidate
  event.respondWith(
    caches.match(request).then((hit) => {
      const refresh = fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy));
        return res;
      }).catch(() => hit);
      return hit || refresh;
    })
  );
});
