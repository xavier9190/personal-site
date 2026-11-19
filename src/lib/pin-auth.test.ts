import { describe, expect, it } from 'vitest';
import {
  createPinSessionToken,
  evaluatePinAccess,
  verifyPinInput,
} from './pin-auth';

const TEST_PIN = 'minha-senha-mestre-2026!';
const TEST_SECRET = 'super-secret-hmac-key-for-tests-32bytes';
const BASE_TIME = Date.UTC(2026, 0, 1, 12, 0, 0);
const DAY_MS = 24 * 60 * 60 * 1000;

describe('Auth seam — HMAC-SHA256 session tokens, expiration & fail-closed', () => {
  it('accepts HMAC-SHA256 signed tokens within 7, 30, and 90 days and rejects immediately upon expiration', async () => {
    for (const sessionDays of [7, 30, 90] as const) {
      const token = await createPinSessionToken({
        configuredPin: TEST_PIN,
        authSecret: TEST_SECRET,
        sessionDays,
        maxSessionDays: 90,
        nowMs: BASE_TIME,
      });

      const validBeforeExpiry = await evaluatePinAccess({
        configuredPin: TEST_PIN,
        authSecret: TEST_SECRET,
        sessionCookie: token,
        nodeEnv: 'production',
        maxSessionDays: 90,
        nowMs: BASE_TIME + sessionDays * DAY_MS - 1000,
      });
      expect(validBeforeExpiry).toMatchObject({ allowed: true, requiresPin: true });

      const rejectedAtExpiry = await evaluatePinAccess({
        configuredPin: TEST_PIN,
        authSecret: TEST_SECRET,
        sessionCookie: token,
        nodeEnv: 'production',
        maxSessionDays: 90,
        nowMs: BASE_TIME + sessionDays * DAY_MS,
      });
      expect(rejectedAtExpiry).toMatchObject({ allowed: false, requiresPin: true });
    }
  });

  it('rejects a token whose duration exceeds AUTH_MAX_SESSION_DAYS', async () => {
    const token90Days = await createPinSessionToken({
      configuredPin: TEST_PIN,
      authSecret: TEST_SECRET,
      sessionDays: 90,
      maxSessionDays: 90,
      nowMs: BASE_TIME,
    });

    const evaluation = await evaluatePinAccess({
      configuredPin: TEST_PIN,
      authSecret: TEST_SECRET,
      sessionCookie: token90Days,
      nodeEnv: 'production',
      maxSessionDays: 30,
      nowMs: BASE_TIME + 1 * DAY_MS,
    });

    expect(evaluation).toMatchObject({ allowed: false, requiresPin: true });
  });

  it('rejects tampered tokens or tokens issued with a different credential or AUTH_SECRET', async () => {
    const token = await createPinSessionToken({
      configuredPin: TEST_PIN,
      authSecret: TEST_SECRET,
      sessionDays: 30,
      maxSessionDays: 90,
      nowMs: BASE_TIME,
    });

    const [payloadPart, sigPart] = token.split('.');
    const tamperedSig = `${payloadPart}.${sigPart.slice(0, -2)}AA`;
    const tamperedPayload = `${payloadPart.slice(0, -2)}AA.${sigPart}`;

    expect(
      await evaluatePinAccess({
        configuredPin: TEST_PIN,
        authSecret: TEST_SECRET,
        sessionCookie: tamperedSig,
        nodeEnv: 'production',
        nowMs: BASE_TIME + 1000,
      }),
    ).toMatchObject({ allowed: false, requiresPin: true });

    expect(
      await evaluatePinAccess({
        configuredPin: TEST_PIN,
        authSecret: TEST_SECRET,
        sessionCookie: tamperedPayload,
        nodeEnv: 'production',
        nowMs: BASE_TIME + 1000,
      }),
    ).toMatchObject({ allowed: false, requiresPin: true });

    expect(
      await evaluatePinAccess({
        configuredPin: 'nova-senha-mestre-rotacionada!',
        authSecret: TEST_SECRET,
        sessionCookie: token,
        nodeEnv: 'production',
        nowMs: BASE_TIME + 1000,
      }),
    ).toMatchObject({ allowed: false, requiresPin: true });

    expect(
      await evaluatePinAccess({
        configuredPin: TEST_PIN,
        authSecret: 'outro-auth-secret-rotacionado',
        sessionCookie: token,
        nodeEnv: 'production',
        nowMs: BASE_TIME + 1000,
      }),
    ).toMatchObject({ allowed: false, requiresPin: true });
  });

  it('enforces Fail-Closed in production when credential or AUTH_SECRET is missing, while keeping non-production open when unconfigured', async () => {
    expect(
      await evaluatePinAccess({
        configuredPin: undefined,
        authSecret: TEST_SECRET,
        sessionCookie: undefined,
        nodeEnv: 'production',
      }),
    ).toMatchObject({ allowed: false, requiresPin: true, misconfigured: true });

    expect(
      await evaluatePinAccess({
        configuredPin: TEST_PIN,
        authSecret: undefined,
        sessionCookie: undefined,
        nodeEnv: 'production',
      }),
    ).toMatchObject({ allowed: false, requiresPin: true, misconfigured: true });

    expect(
      await evaluatePinAccess({
        configuredPin: undefined,
        authSecret: undefined,
        sessionCookie: undefined,
        nodeEnv: 'development',
      }),
    ).toMatchObject({ allowed: true, requiresPin: false, misconfigured: false });
  });

  it('verifies credential input in constant time (SHA-256 digest)', async () => {
    expect(await verifyPinInput(TEST_PIN, TEST_PIN)).toBe(true);
    expect(await verifyPinInput('  ' + TEST_PIN + '  ', TEST_PIN)).toBe(true);
    expect(await verifyPinInput('wrong-password', TEST_PIN)).toBe(false);
    expect(await verifyPinInput('', TEST_PIN)).toBe(false);
  });
});
