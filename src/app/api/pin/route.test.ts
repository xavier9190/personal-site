import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { DELETE, POST } from './route';
import { evaluatePinAccess, PIN_COOKIE_NAME } from '@/lib/pin-auth';
import { loginRateLimiter } from '@/lib/rate-limit';

const ORIGINAL_ENV = { ...process.env };
const TEST_PIN = 'chave-mestre-ultra-2026';
const TEST_SECRET = 'hmac-secret-key-for-route-tests-2026';

function createLoginRequest(
  body: Record<string, unknown>,
  ip = '203.0.113.10',
): NextRequest {
  return new NextRequest('https://hub.example.com/api/pin', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-forwarded-for': ip,
    },
    body: JSON.stringify(body),
  });
}

describe('/api/pin HTTP seam (login, rate limit, fail-closed, logout)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'production',
      APP_ACCESS_PIN: TEST_PIN,
      AUTH_SECRET: TEST_SECRET,
      AUTH_SESSION_DAYS: '30',
      AUTH_MAX_SESSION_DAYS: '90',
    };
    loginRateLimiter.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = { ...ORIGINAL_ENV };
    loginRateLimiter.clear();
  });

  it('issues an HMAC-signed cookie with HttpOnly, SameSite=Lax, Secure in production and Max-Age matching selected days', async () => {
    const res = await POST(createLoginRequest({ pin: TEST_PIN, sessionDays: 7 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ ok: true, sessionDays: 7 });

    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${PIN_COOKIE_NAME}=`);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain(`Max-Age=${7 * 24 * 60 * 60}`);

    const cookieVal = res.cookies.get(PIN_COOKIE_NAME)?.value;
    expect(cookieVal).toBeTruthy();

    const check = await evaluatePinAccess({
      configuredPin: TEST_PIN,
      authSecret: TEST_SECRET,
      sessionCookie: cookieVal,
      nodeEnv: 'production',
      maxSessionDays: 90,
      nowMs: Date.now(),
    });
    expect(check.allowed).toBe(true);
  });

  it('clamps requested sessionDays to AUTH_MAX_SESSION_DAYS and defaults to AUTH_SESSION_DAYS', async () => {
    process.env.AUTH_SESSION_DAYS = '7';
    process.env.AUTH_MAX_SESSION_DAYS = '30';

    const resDefault = await POST(createLoginRequest({ pin: TEST_PIN }));
    expect(resDefault.status).toBe(200);
    expect(await resDefault.json()).toMatchObject({ ok: true, sessionDays: 7 });
    expect(resDefault.headers.get('set-cookie')).toContain(`Max-Age=${7 * 24 * 60 * 60}`);

    const resClamped = await POST(createLoginRequest({ pin: TEST_PIN, sessionDays: 90 }));
    expect(resClamped.status).toBe(200);
    expect(await resClamped.json()).toMatchObject({ ok: true, sessionDays: 30 });
    expect(resClamped.headers.get('set-cookie')).toContain(`Max-Age=${30 * 24 * 60 * 60}`);
  });

  it('returns 429 on the 6th failed attempt from the same IP within 15 minutes and resets after a successful login', async () => {
    const ip = '198.51.100.42';

    // 4 failures followed by 1 success should reset counter
    for (let i = 0; i < 4; i++) {
      const res = await POST(createLoginRequest({ pin: 'wrong' }, ip));
      expect(res.status).toBe(401);
    }
    const okRes = await POST(createLoginRequest({ pin: TEST_PIN }, ip));
    expect(okRes.status).toBe(200);

    // Now 5 consecutive failures return 401, and the 6th returns 429
    for (let i = 0; i < 5; i++) {
      const res = await POST(createLoginRequest({ pin: 'wrong' }, ip));
      expect(res.status).toBe(401);
    }

    const blockedRes = await POST(createLoginRequest({ pin: 'wrong' }, ip));
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get('retry-after')).toBeTruthy();

    // Another IP is not blocked
    const otherIpRes = await POST(createLoginRequest({ pin: TEST_PIN }, '198.51.100.99'));
    expect(otherIpRes.status).toBe(200);

    // After 15 minutes window elapses, original IP can log in again
    vi.advanceTimersByTime(15 * 60 * 1000 + 1000);
    const recoveredRes = await POST(createLoginRequest({ pin: TEST_PIN }, ip));
    expect(recoveredRes.status).toBe(200);
  });

  it('fails closed (503) in production when APP_ACCESS_PIN or AUTH_SECRET is missing', async () => {
    delete process.env.AUTH_SECRET;
    const res = await POST(createLoginRequest({ pin: TEST_PIN }));
    expect(res.status).toBe(503);
    expect(res.cookies.get(PIN_COOKIE_NAME)).toBeUndefined();
  });

  it('clears the session cookie on DELETE /api/pin', async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });

    const setCookie = res.headers.get('set-cookie') ?? '';
    expect(setCookie).toContain(`${PIN_COOKIE_NAME}=;`);
    expect(setCookie).toContain('Max-Age=0');
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie.toLowerCase()).toContain('samesite=lax');
    expect(setCookie).toContain('Secure');
  });
});
