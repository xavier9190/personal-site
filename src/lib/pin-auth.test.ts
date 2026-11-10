import { describe, expect, it } from 'vitest';
import { createPinSessionToken, evaluatePinAccess, verifyPinInput } from './pin-auth';

describe('PIN access seam (APP_ACCESS_PIN local Wi-Fi guard)', () => {
  it('allows direct access without login screen when APP_ACCESS_PIN is empty or undefined', () => {
    expect(evaluatePinAccess({ configuredPin: undefined, sessionCookie: undefined })).toEqual({
      allowed: true,
      requiresPin: false,
    });
    expect(evaluatePinAccess({ configuredPin: '   ', sessionCookie: undefined })).toEqual({
      allowed: true,
      requiresPin: false,
    });
  });

  it('blocks access when APP_ACCESS_PIN is configured and session cookie is missing or invalid', () => {
    expect(evaluatePinAccess({ configuredPin: '1234', sessionCookie: undefined })).toEqual({
      allowed: false,
      requiresPin: true,
    });
    expect(evaluatePinAccess({ configuredPin: '1234', sessionCookie: 'wrong-token' })).toEqual({
      allowed: false,
      requiresPin: true,
    });
  });

  it('verifies PIN input and grants access when valid session token is present', () => {
    expect(verifyPinInput('1234', '1234')).toBe(true);
    expect(verifyPinInput('9999', '1234')).toBe(false);

    const token = createPinSessionToken('1234');
    expect(evaluatePinAccess({ configuredPin: '1234', sessionCookie: token })).toEqual({
      allowed: true,
      requiresPin: true,
    });
  });
});
