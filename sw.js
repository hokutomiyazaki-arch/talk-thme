// FNT Neuro Card Service Worker
const CACHE_NAME = 'fnt-neuro-card-v1.0.0';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './FNT512.png',
    './FNT512-transparent.png'
];

// 外部リソース（CDN）
const EXTERNAL_RESOURCES = [
    'https://unpkg.com/react@18/umd/react.production.min.js',
    'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
    'https://unpkg.com/@babel/standalone/babel.min.js',
    'https://unpkg.com/framer-motion@10.16.4/dist/framer-motion.js',
    'https://cdn.tailwindcss.com',
    'https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Rajdhani:wght@300;400;500;600;700&display=swap'
];

// インストール時
self.addEventListener('install', (event) => {
    console.log('[SW] Installing Service Worker...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching app shell...');
                
                // ローカルアセットをキャッシュ
                const localCachePromises = ASSETS_TO_CACHE.map(url => {
                    return cache.add(url).catch(err => {
                        console.warn('[SW] Failed to cache:', url, err);
                    });
                });
                
                // 外部リソースをキャッシュ
                const externalCachePromises = EXTERNAL_RESOURCES.map(url => {
                    return fetch(url, { mode: 'cors' })
                        .then(response => {
                            if (response.ok) {
                                return cache.put(url, response);
                            }
                        })
                        .catch(err => {
                            console.warn('[SW] Failed to cache external:', url, err);
                        });
                });
                
                return Promise.all([...localCachePromises, ...externalCachePromises]);
            })
            .then(() => {
                console.log('[SW] All assets cached');
                return self.skipWaiting();
            })
    );
});

// アクティベート時
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating Service Worker...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => {
                        if (cacheName !== CACHE_NAME) {
                            console.log('[SW] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        }
                    })
                );
            })
            .then(() => {
                console.log('[SW] Service Worker activated');
                return self.clients.claim();
            })
    );
});

// フェッチ時
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);
    
    // Google Fontsの特別処理
    if (requestUrl.hostname === 'fonts.googleapis.com' || 
        requestUrl.hostname === 'fonts.gstatic.com') {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    if (response) {
                        return response;
                    }
                    return fetch(event.request)
                        .then(fetchResponse => {
                            if (fetchResponse.ok) {
                                const responseClone = fetchResponse.clone();
                                caches.open(CACHE_NAME)
                                    .then(cache => cache.put(event.request, responseClone));
                            }
                            return fetchResponse;
                        })
                        .catch(() => {
                            // フォントが取得できない場合はシステムフォントにフォールバック
                            return new Response('', { status: 200 });
                        });
                })
        );
        return;
    }
    
    // その他のリクエスト
    event.respondWith(
        caches.match(event.request)
            .then((response) => {
                // キャッシュにあればキャッシュを返す
                if (response) {
                    return response;
                }
                
                // キャッシュになければネットワークから取得
                return fetch(event.request)
                    .then((fetchResponse) => {
                        // 有効なレスポンスのみキャッシュ
                        if (!fetchResponse || fetchResponse.status !== 200) {
                            return fetchResponse;
                        }
                        
                        // レスポンスをクローンしてキャッシュ
                        const responseClone = fetchResponse.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseClone);
                            });
                        
                        return fetchResponse;
                    })
                    .catch((error) => {
                        console.error('[SW] Fetch failed:', error);
                        
                        // オフライン時のフォールバック
                        if (event.request.mode === 'navigate') {
                            return caches.match('./index.html');
                        }
                        
                        return new Response('Offline', { status: 503 });
                    });
            })
    );
});

// バージョン更新通知
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
