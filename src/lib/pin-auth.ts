export const PIN_COOKIE_NAME = 'personal_site_pin_session' as const;

export interface PinAccessEvaluation {
  allowed: boolean;
  requiresPin: boolean;
}

export function createPinSessionToken(configuredPin: string): string {
  const normalized = configuredPin.trim();
  // Deterministic lightweight token suitable for Edge/Node middleware without native crypto dependencies
  let hash = 2166136261;
  for (let i = 0; i < normalized.length; i++) {
    hash ^= normalized.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `pin_ok_${(hash >>> 0).toString(16)}`;
}

export function verifyPinInput(inputPin: string, configuredPin?: string): boolean {
  const target = configuredPin?.trim();
  if (!target) {
    return true;
  }
  return inputPin.trim() === target;
}

export function evaluatePinAccess(params: {
  configuredPin?: string;
  sessionCookie?: string;
}): PinAccessEvaluation {
  const target = params.configuredPin?.trim();
  if (!target) {
    return { allowed: true, requiresPin: false };
  }

  const expectedToken = createPinSessionToken(target);
  const allowed = params.sessionCookie === expectedToken;
  return {
    allowed,
    requiresPin: true,
  };
}
