import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { setDbForTesting } from '@/db';
import { createPgliteTestDb } from '@/db/pglite-test';
import { createPinSessionToken, PIN_COOKIE_NAME } from '@/lib/pin-auth';

const mockCookieGet = vi.fn();

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: mockCookieGet,
  })),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

import { requireSessionAuth, UnauthorizedSessionError } from './session-auth';
import * as calendarActions from '@/features/calendar/actions';
import * as financeActions from '@/features/finances/actions';
import * as billActions from '@/features/finances/bill-actions';
import * as academicActions from '@/features/academic/actions';
import * as shoppingActions from '@/features/shopping/actions';
import * as chatActions from '@/features/chat/actions';

const ORIGINAL_ENV = { ...process.env };
const TEST_PIN = 'chave-mestre-session-guard-2026';
const TEST_SECRET = 'hmac-secret-session-guard-2026';

describe('Session auth guard — requireSessionAuth', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
    mockCookieGet.mockReset();
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

  it('rejects with UnauthorizedSessionError when session cookie is missing', async () => {
    mockCookieGet.mockReturnValue(undefined);

    await expect(requireSessionAuth()).rejects.toBeInstanceOf(UnauthorizedSessionError);
  });

  it('allows execution when next/headers cookies() contains a valid HMAC-SHA256 token and rejects after expiry', async () => {
    const token = await createPinSessionToken({
      configuredPin: TEST_PIN,
      authSecret: TEST_SECRET,
      sessionDays: 7,
      maxSessionDays: 90,
      nowMs: Date.now(),
    });
    mockCookieGet.mockImplementation((name: string) =>
      name === PIN_COOKIE_NAME ? { name, value: token } : undefined,
    );

    await expect(requireSessionAuth()).resolves.toBeUndefined();

    vi.advanceTimersByTime(7 * 24 * 60 * 60 * 1000 + 1000);
    await expect(requireSessionAuth()).rejects.toBeInstanceOf(UnauthorizedSessionError);
  });

  it('reads session cookie from NextRequest when provided', async () => {
    const token = await createPinSessionToken({
      configuredPin: TEST_PIN,
      authSecret: TEST_SECRET,
      sessionDays: 30,
      maxSessionDays: 90,
      nowMs: Date.now(),
    });

    const unauthReq = new NextRequest('https://hub.example.com/api/chat/stream', {
      method: 'POST',
    });
    await expect(requireSessionAuth(unauthReq)).rejects.toBeInstanceOf(UnauthorizedSessionError);

    const authReq = new NextRequest('https://hub.example.com/api/chat/stream', {
      method: 'POST',
      headers: { cookie: `${PIN_COOKIE_NAME}=${token}` },
    });
    await expect(requireSessionAuth(authReq)).resolves.toBeUndefined();
  });

  it('enforces Fail-Closed in production when APP_ACCESS_PIN or AUTH_SECRET is missing', async () => {
    delete process.env.AUTH_SECRET;

    let caught: unknown;
    try {
      await requireSessionAuth();
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(UnauthorizedSessionError);
    expect((caught as UnauthorizedSessionError).misconfigured).toBe(true);
    expect((caught as UnauthorizedSessionError).status).toBe(401);
  });

  it('allows execution in non-production when APP_ACCESS_PIN is unset', async () => {
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: 'test',
    };
    delete process.env.APP_ACCESS_PIN;
    delete process.env.AUTH_SECRET;

    await expect(requireSessionAuth()).resolves.toBeUndefined();
  });
});

describe('Server Actions defense-in-depth — all 5 Hub Pessoal modules', () => {
  let closeTestDb: (() => Promise<void>) | null = null;

  beforeAll(async () => {
    const { db, close } = await createPgliteTestDb();
    setDbForTesting(db);
    closeTestDb = close;
  });

  afterAll(async () => {
    setDbForTesting(null);
    if (closeTestDb) {
      await closeTestDb();
      closeTestDb = null;
    }
  });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-01T12:00:00Z'));
    mockCookieGet.mockReset();
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

  it('refuses unauthenticated execution for EVERY exported Server Action across all 5 modules', async () => {
    mockCookieGet.mockReturnValue(undefined);

    const actionModules: Array<[string, Record<string, unknown>]> = [
      ['calendar', calendarActions],
      ['finances/transactions', financeActions],
      ['finances/bills', billActions],
      ['academic', academicActions],
      ['shopping', shoppingActions],
      ['chat', chatActions],
    ];

    for (const [moduleName, mod] of actionModules) {
      const exportedFns = Object.entries(mod).filter(([, value]) => typeof value === 'function');
      expect(exportedFns.length, `${moduleName} should export Server Actions`).toBeGreaterThan(0);

      for (const [fnName, fn] of exportedFns) {
        await expect(
          (fn as (...args: unknown[]) => Promise<unknown>)(),
          `${moduleName}.${fnName} must reject unauthenticated calls`,
        ).rejects.toBeInstanceOf(UnauthorizedSessionError);
      }
    }
  });

  it('allows authenticated Server Actions across all 5 modules when a valid HMAC-SHA256 session cookie is present', async () => {
    const token = await createPinSessionToken({
      configuredPin: TEST_PIN,
      authSecret: TEST_SECRET,
      sessionDays: 30,
      maxSessionDays: 90,
      nowMs: Date.now(),
    });
    mockCookieGet.mockImplementation((name: string) =>
      name === PIN_COOKIE_NAME ? { name, value: token } : undefined,
    );

    const calendarItems = await calendarActions.listCalendarItemsAction(
      '2026-06-01T00:00:00Z',
      '2026-06-30T23:59:59Z',
    );
    expect(Array.isArray(calendarItems)).toBe(true);

    const toggleRes = await financeActions.toggleHideBalanceAction();
    expect(toggleRes.ok).toBe(true);

    const billRes = await billActions.createCreditCardAction({
      name: 'Cartão Teste',
      closingDay: 10,
      dueDay: 17,
    });
    expect(billRes.ok).toBe(true);

    const projectRes = await academicActions.createProjectAction({
      title: 'Projeto TCC',
      description: 'Teste autenticado',
      finalDeliveryDate: '2026-07-01',
    });
    expect(projectRes.ok).toBe(true);

    const wishlistRes = await shoppingActions.addWishlistItemAction({
      name: 'Teclado Mecânico',
      priceCents: 35000,
    });
    expect(wishlistRes.ok).toBe(true);

    const threadRes = await chatActions.createNewThreadAction('Conversa Autenticada');
    expect(threadRes.ok).toBe(true);
    expect(typeof threadRes.threadId).toBe('string');
  });
});
