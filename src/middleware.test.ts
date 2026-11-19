import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { middleware } from './middleware';
import { createPinSessionToken, PIN_COOKIE_NAME } from '@/lib/pin-auth';

const ORIGINAL_ENV = { ...process.env };
const TEST_PIN = 'chave-mestre-middleware-2026';
const TEST_SECRET = 'hmac-secret-middleware-tests-2026';

describe('Middleware auth seam', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'production',
      APP_ACCESS_PIN: TEST_PIN,
      AUTH_SECRET: TEST_SECRET,
      AUTH_MAX_SESSION_DAYS: '90',
    };
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...ORIGINAL_ENV };
  });

  it('redirects unauthenticated page requests to /pin with next param', async () => {
    const req = new NextRequest('https://hub.example.com/financas');
    const res = await middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('https://hub.example.com/pin?next=%2Ffinancas');
  });

  it('returns 401 JSON for unauthenticated private API requests', async () => {
    const req = new NextRequest('https://hub.example.com/api/chat/stream', {
      method: 'POST',
    });
    const res = await middleware(req);

    expect(res.status).toBe(401);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body).toMatchObject({ ok: false });
    expect(typeof body.error).toBe('string');
  });

  it('allows authenticated page and private API requests with a valid HMAC token and blocks after expiry', async () => {
    const token = await createPinSessionToken({
      configuredPin: TEST_PIN,
      authSecret: TEST_SECRET,
      sessionDays: 7,
      maxSessionDays: 90,
      nowMs: Date.now(),
    });

    const pageReq = new NextRequest('https://hub.example.com/calendario', {
      headers: { cookie: `${PIN_COOKIE_NAME}=${token}` },
    });
    const pageRes = await middleware(pageReq);
    expect(pageRes.headers.get('x-middleware-next')).toBe('1');

    const apiReq = new NextRequest('https://hub.example.com/api/chat/stream', {
      method: 'POST',
      headers: { cookie: `${PIN_COOKIE_NAME}=${token}` },
    });
    const apiRes = await middleware(apiReq);
    expect(apiRes.headers.get('x-middleware-next')).toBe('1');

    // Advance past 7 days -> should now be rejected
    vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 + 1000);

    const expiredApiRes = await middleware(apiReq);
    expect(expiredApiRes.status).toBe(401);

    const expiredPageRes = await middleware(pageReq);
    expect(expiredPageRes.status).toBe(307);
  });

  it('enforces Fail-Closed in production when AUTH_SECRET or APP_ACCESS_PIN is missing', async () => {
    delete process.env.AUTH_SECRET;

    const pageRes = await middleware(new NextRequest('https://hub.example.com/'));
    expect(pageRes.status).toBe(307);
    expect(pageRes.headers.get('location')).toBe('https://hub.example.com/pin?next=%2F');

    const apiRes = await middleware(new NextRequest('https://hub.example.com/api/chat/stream'));
    expect(apiRes.status).toBe(401);
  });

  it('allows public auth and static endpoints through even when unauthenticated', async () => {
    for (const path of ['/pin', '/api/pin', '/manifest.webmanifest', '/favicon.ico']) {
      const res = await middleware(new NextRequest(`https://hub.example.com${path}`));
      expect(res.headers.get('x-middleware-next')).toBe('1');
    }
  });
});
