import { describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const SW_PATH = path.resolve(process.cwd(), 'public', 'sw.js');

interface MockCache {
  entries: Map<string, Response>;
  addAll: ReturnType<typeof vi.fn>;
  put: ReturnType<typeof vi.fn>;
  match: ReturnType<typeof vi.fn>;
}

function createSwHarness(options?: {
  fetchImpl?: (req: Request) => Promise<Response>;
  existingCaches?: string[];
}) {
  expect(existsSync(SW_PATH), 'public/sw.js must exist').toBe(true);
  const code = readFileSync(SW_PATH, 'utf8');

  const cacheStore = new Map<string, MockCache>();
  const deletedCaches: string[] = [];

  for (const name of options?.existingCaches ?? []) {
    const entries = new Map<string, Response>();
    cacheStore.set(name, {
      entries,
      addAll: vi.fn(),
      put: vi.fn(),
      match: vi.fn(),
    });
  }

  function getOrCreateCache(name: string): MockCache {
    let cache = cacheStore.get(name);
    if (!cache) {
      const entries = new Map<string, Response>();
      cache = {
        entries,
        addAll: vi.fn(async (urls: string[]) => {
          for (const url of urls) {
            entries.set(url, new Response(`cached:${url}`, { status: 200 }));
          }
        }),
        put: vi.fn(async (req: Request | string, res: Response) => {
          const key = typeof req === 'string' ? req : new URL(req.url).pathname;
          entries.set(key, res);
        }),
        match: vi.fn(async (req: Request | string) => {
          const key = typeof req === 'string' ? req : new URL(req.url).pathname;
          return entries.get(key);
        }),
      };
      cacheStore.set(name, cache);
    }
    return cache;
  }

  const cachesMock = {
    open: vi.fn(async (name: string) => getOrCreateCache(name)),
    keys: vi.fn(async () => Array.from(cacheStore.keys())),
    delete: vi.fn(async (name: string) => {
      deletedCaches.push(name);
      return cacheStore.delete(name);
    }),
    match: vi.fn(async (req: Request | string) => {
      const key = typeof req === 'string' ? req : new URL(req.url).pathname;
      for (const cache of cacheStore.values()) {
        const hit = cache.entries.get(key);
        if (hit) return hit;
      }
      return undefined;
    }),
  };

  const listeners = new Map<string, Array<(event: unknown) => void>>();
  const skipWaiting = vi.fn(async () => undefined);
  const claim = vi.fn(async () => undefined);
  const fetchMock = vi.fn(
    options?.fetchImpl ?? (async (req: Request) => new Response(`network:${req.url}`, { status: 200 })),
  );

  const selfMock = {
    location: new URL('https://hub.example.com/sw.js'),
    addEventListener: (type: string, cb: (event: unknown) => void) => {
      const list = listeners.get(type) ?? [];
      list.push(cb);
      listeners.set(type, list);
    },
    skipWaiting,
    clients: { claim },
  };

  vm.runInNewContext(code, {
    self: selfMock,
    caches: cachesMock,
    fetch: fetchMock,
    URL,
    Response,
    Request,
  });

  async function dispatchLifecycle(type: 'install' | 'activate') {
    const promises: Promise<unknown>[] = [];
    const event = {
      waitUntil: (p: Promise<unknown>) => promises.push(p),
    };
    for (const cb of listeners.get(type) ?? []) {
      cb(event);
    }
    await Promise.all(promises);
  }

  async function dispatchFetch(request: {
    url: string;
    method?: string;
    mode?: string;
    destination?: string;
  }): Promise<{ intercepted: boolean; response: Response | null }> {
    let responsePromise: Promise<Response> | null = null;
    const reqObj = {
      url: request.url,
      method: request.method ?? 'GET',
      mode: request.mode ?? 'cors',
      destination: request.destination ?? '',
    };
    const event = {
      request: reqObj,
      respondWith: (p: Promise<Response> | Response) => {
        responsePromise = Promise.resolve(p);
      },
    };
    for (const cb of listeners.get('fetch') ?? []) {
      cb(event);
    }
    const resolvedPromise = responsePromise as Promise<Response> | null;
    return {
      intercepted: resolvedPromise !== null,
      response: resolvedPromise ? await resolvedPromise : null,
    };
  }

  return {
    cacheStore,
    deletedCaches,
    cachesMock,
    fetchMock,
    skipWaiting,
    claim,
    dispatchLifecycle,
    dispatchFetch,
  };
}

describe('Service Worker safety & offline contract (Seam 3)', () => {
  it('pre-caches ONLY static public assets (font, icons, /offline) and never private routes or APIs', async () => {
    const sw = createSwHarness();
    await sw.dispatchLifecycle('install');

    expect(sw.skipWaiting).toHaveBeenCalledTimes(1);
    expect(sw.cacheStore.size).toBe(1);

    const activeCache = Array.from(sw.cacheStore.values())[0];
    const cachedPaths = Array.from(activeCache.entries.keys());

    expect(cachedPaths).toEqual(
      expect.arrayContaining([
        '/offline',
        '/fonts/Excalifont-Regular.woff2',
        '/icons/icon.svg',
        '/icons/icon-192.png',
        '/icons/icon-512.png',
        '/icons/apple-touch-icon.png',
      ]),
    );

    // Must NEVER pre-cache private pages or API routes
    for (const p of cachedPaths) {
      expect(p).not.toBe('/');
      expect(p.startsWith('/api/')).toBe(false);
      expect(p.startsWith('/calendario')).toBe(false);
      expect(p.startsWith('/financas')).toBe(false);
      expect(p.startsWith('/academico')).toBe(false);
      expect(p.startsWith('/compras')).toBe(false);
    }
  });

  it('cleans up old caches on activate and claims clients', async () => {
    const sw = createSwHarness({ existingCaches: ['stale-cache-v0'] });
    await sw.dispatchLifecycle('install');
    await sw.dispatchLifecycle('activate');

    expect(sw.deletedCaches).toContain('stale-cache-v0');
    expect(sw.claim).toHaveBeenCalledTimes(1);
  });

  it('never intercepts or caches /api/* requests or non-GET requests', async () => {
    const sw = createSwHarness();
    await sw.dispatchLifecycle('install');

    const apiGet = await sw.dispatchFetch({
      url: 'https://hub.example.com/api/chat/stream',
      method: 'GET',
    });
    expect(apiGet.intercepted).toBe(false);

    const apiPost = await sw.dispatchFetch({
      url: 'https://hub.example.com/api/pin',
      method: 'POST',
    });
    expect(apiPost.intercepted).toBe(false);

    const actionPost = await sw.dispatchFetch({
      url: 'https://hub.example.com/financas',
      method: 'POST',
    });
    expect(actionPost.intercepted).toBe(false);

    const activeCache = Array.from(sw.cacheStore.values())[0];
    expect(activeCache.put).not.toHaveBeenCalled();
  });

  it('never caches authenticated HTML navigations when online, and falls back to /offline when offline', async () => {
    // Online navigation: passes through to network without caching HTML
    const onlineSw = createSwHarness({
      fetchImpl: async () => new Response('<html>PRIVATE FINANCES</html>', { status: 200 }),
    });
    await onlineSw.dispatchLifecycle('install');

    const onlineNav = await onlineSw.dispatchFetch({
      url: 'https://hub.example.com/financas',
      method: 'GET',
      mode: 'navigate',
    });
    expect(onlineNav.intercepted).toBe(true);
    expect(await onlineNav.response?.text()).toBe('<html>PRIVATE FINANCES</html>');

    const activeCache = Array.from(onlineSw.cacheStore.values())[0];
    expect(activeCache.put).not.toHaveBeenCalled();
    expect(activeCache.entries.has('/financas')).toBe(false);

    // Offline navigation: falls back to cached /offline
    const offlineSw = createSwHarness({
      fetchImpl: async () => {
        throw new TypeError('Failed to fetch');
      },
    });
    await offlineSw.dispatchLifecycle('install');

    const offlineNav = await offlineSw.dispatchFetch({
      url: 'https://hub.example.com/calendario',
      method: 'GET',
      mode: 'navigate',
    });
    expect(offlineNav.intercepted).toBe(true);
    expect(await offlineNav.response?.text()).toBe('cached:/offline');
  });

  it('serves static public assets (icons, fonts) from cache', async () => {
    const sw = createSwHarness({
      fetchImpl: async () => {
        throw new Error('Should not hit network for pre-cached static asset');
      },
    });
    await sw.dispatchLifecycle('install');

    const iconRes = await sw.dispatchFetch({
      url: 'https://hub.example.com/icons/icon-192.png',
      method: 'GET',
    });
    expect(iconRes.intercepted).toBe(true);
    expect(await iconRes.response?.text()).toBe('cached:/icons/icon-192.png');
    expect(sw.fetchMock).not.toHaveBeenCalled();
  });
});
