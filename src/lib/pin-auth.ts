export const PIN_COOKIE_NAME = 'personal_site_pin_session' as const;
export const ALLOWED_SESSION_DAYS = [7, 30, 90] as const;
export const DEFAULT_SESSION_DAYS = 30;
export const DEFAULT_MAX_SESSION_DAYS = 90;

const DEV_FALLBACK_SECRET = 'personal-site-dev-local-hmac-secret';
const SECONDS_PER_DAY = 60 * 60 * 24;
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface SessionTokenPayload {
  sub: 'owner';
  iat: number;
  exp: number;
  cred: string;
}

export interface PinAccessEvaluation {
  allowed: boolean;
  requiresPin: boolean;
  misconfigured: boolean;
}

export interface ResolvedAuthConfig {
  configuredPin: string;
  authSecret: string;
  isProduction: boolean;
  isMisconfigured: boolean;
  defaultSessionDays: number;
  maxSessionDays: number;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (!raw?.trim()) return fallback;
  const parsed = Number.parseInt(raw.trim(), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

export function resolveAuthConfig(
  env: Record<string, string | undefined> = process.env,
): ResolvedAuthConfig {
  const configuredPin = env.APP_ACCESS_PIN?.trim() ?? '';
  const rawSecret = env.AUTH_SECRET?.trim() ?? '';
  const isProduction = env.NODE_ENV === 'production';
  const isMisconfigured = isProduction && (!configuredPin || !rawSecret);
  const authSecret = rawSecret || (!isProduction && configuredPin ? DEV_FALLBACK_SECRET : '');
  const maxSessionDays = parsePositiveInt(env.AUTH_MAX_SESSION_DAYS, DEFAULT_MAX_SESSION_DAYS);
  const rawDefault = parsePositiveInt(env.AUTH_SESSION_DAYS, DEFAULT_SESSION_DAYS);
  const defaultSessionDays = Math.min(rawDefault, maxSessionDays);

  return {
    configuredPin,
    authSecret,
    isProduction,
    isMisconfigured,
    defaultSessionDays,
    maxSessionDays,
  };
}

export function resolveSessionDays(
  requestedDays: unknown,
  config: { defaultSessionDays: number; maxSessionDays: number },
): number {
  const maxDays = Math.max(1, Math.floor(config.maxSessionDays));
  const fallback = Math.min(Math.max(1, Math.floor(config.defaultSessionDays)), maxDays);

  if (typeof requestedDays !== 'number' || !Number.isFinite(requestedDays)) {
    return fallback;
  }

  const normalized = Math.floor(requestedDays);
  if (normalized < 1) return fallback;
  return Math.min(normalized, maxDays);
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(value: string): Uint8Array | null {
  if (!value || /[^A-Za-z0-9\-_]/.test(value)) {
    return null;
  }
  try {
    const padded = value.replace(/-/g, '+').replace(/_/g, '/');
    const padLength = (4 - (padded.length % 4)) % 4;
    const binary = atob(padded + '='.repeat(padLength));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}

async function sha256Bytes(value: string): Promise<Uint8Array> {
  const digest = await globalThis.crypto.subtle.digest('SHA-256', textEncoder.encode(value));
  return new Uint8Array(digest);
}

function constantTimeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}

async function hmacSha256(secret: string, message: string): Promise<Uint8Array> {
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    textEncoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await globalThis.crypto.subtle.sign('HMAC', key, textEncoder.encode(message));
  return new Uint8Array(signature);
}

export async function verifyPinInput(
  inputPin: string,
  configuredPin?: string,
): Promise<boolean> {
  const target = configuredPin?.trim();
  const candidate = inputPin.trim();
  if (!target || !candidate) {
    return false;
  }

  const [candidateHash, targetHash] = await Promise.all([
    sha256Bytes(candidate),
    sha256Bytes(target),
  ]);
  return constantTimeEqual(candidateHash, targetHash);
}

export async function createPinSessionToken(params: {
  configuredPin: string;
  authSecret: string;
  sessionDays: number;
  maxSessionDays?: number;
  nowMs?: number;
}): Promise<string> {
  const normalizedPin = params.configuredPin.trim();
  const normalizedSecret = params.authSecret.trim();
  if (!normalizedPin || !normalizedSecret) {
    throw new Error('APP_ACCESS_PIN and AUTH_SECRET are required to sign a session token');
  }

  const maxDays = params.maxSessionDays ?? DEFAULT_MAX_SESSION_DAYS;
  const effectiveDays = resolveSessionDays(params.sessionDays, {
    defaultSessionDays: DEFAULT_SESSION_DAYS,
    maxSessionDays: maxDays,
  });

  const nowSeconds = Math.floor((params.nowMs ?? Date.now()) / 1000);
  const credHash = toBase64Url(await sha256Bytes(normalizedPin));

  const payload: SessionTokenPayload = {
    sub: 'owner',
    iat: nowSeconds,
    exp: nowSeconds + effectiveDays * SECONDS_PER_DAY,
    cred: credHash,
  };

  const payloadB64 = toBase64Url(textEncoder.encode(JSON.stringify(payload)));
  const signature = await hmacSha256(normalizedSecret, payloadB64);
  return `${payloadB64}.${toBase64Url(signature)}`;
}

export async function verifyPinSessionToken(params: {
  token: string;
  configuredPin: string;
  authSecret: string;
  maxSessionDays?: number;
  nowMs?: number;
}): Promise<{ valid: boolean; payload?: SessionTokenPayload }> {
  const normalizedPin = params.configuredPin.trim();
  const normalizedSecret = params.authSecret.trim();
  if (!normalizedPin || !normalizedSecret) {
    return { valid: false };
  }

  const parts = params.token.split('.');
  if (parts.length !== 2) {
    return { valid: false };
  }

  const [payloadB64, sigB64] = parts;
  const providedSig = fromBase64Url(sigB64);
  const payloadBytes = fromBase64Url(payloadB64);
  if (!providedSig || !payloadBytes) {
    return { valid: false };
  }

  const expectedSig = await hmacSha256(normalizedSecret, payloadB64);
  if (!constantTimeEqual(providedSig, expectedSig)) {
    return { valid: false };
  }

  let payload: Partial<SessionTokenPayload>;
  try {
    payload = JSON.parse(textDecoder.decode(payloadBytes)) as Partial<SessionTokenPayload>;
  } catch {
    return { valid: false };
  }

  if (
    payload.sub !== 'owner' ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number' ||
    typeof payload.cred !== 'string' ||
    !Number.isFinite(payload.iat) ||
    !Number.isFinite(payload.exp)
  ) {
    return { valid: false };
  }

  const nowSeconds = Math.floor((params.nowMs ?? Date.now()) / 1000);
  if (payload.exp <= nowSeconds || payload.exp <= payload.iat) {
    return { valid: false };
  }

  const maxSessionDays = params.maxSessionDays ?? DEFAULT_MAX_SESSION_DAYS;
  if (payload.exp - payload.iat > maxSessionDays * SECONDS_PER_DAY) {
    return { valid: false };
  }

  const expectedCredBytes = await sha256Bytes(normalizedPin);
  const providedCredBytes = fromBase64Url(payload.cred);
  if (!providedCredBytes || !constantTimeEqual(providedCredBytes, expectedCredBytes)) {
    return { valid: false };
  }

  return {
    valid: true,
    payload: payload as SessionTokenPayload,
  };
}

export async function evaluatePinAccess(params: {
  configuredPin?: string;
  authSecret?: string;
  sessionCookie?: string;
  nodeEnv?: string;
  maxSessionDays?: number;
  nowMs?: number;
}): Promise<PinAccessEvaluation> {
  const config = resolveAuthConfig({
    APP_ACCESS_PIN: params.configuredPin,
    AUTH_SECRET: params.authSecret,
    NODE_ENV: params.nodeEnv ?? process.env.NODE_ENV,
    AUTH_MAX_SESSION_DAYS:
      params.maxSessionDays !== undefined ? String(params.maxSessionDays) : undefined,
  });

  if (config.isMisconfigured) {
    return {
      allowed: false,
      requiresPin: true,
      misconfigured: true,
    };
  }

  if (!config.configuredPin) {
    return {
      allowed: true,
      requiresPin: false,
      misconfigured: false,
    };
  }

  if (!params.sessionCookie) {
    return {
      allowed: false,
      requiresPin: true,
      misconfigured: false,
    };
  }

  const verification = await verifyPinSessionToken({
    token: params.sessionCookie,
    configuredPin: config.configuredPin,
    authSecret: config.authSecret,
    maxSessionDays: config.maxSessionDays,
    nowMs: params.nowMs,
  });

  return {
    allowed: verification.valid,
    requiresPin: true,
    misconfigured: false,
  };
}

function buildBaseCookieOptions(isProduction: boolean) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: isProduction,
    path: '/',
  };
}

export function getSessionCookieOptions(params: {
  sessionDays: number;
  isProduction: boolean;
}) {
  return {
    ...buildBaseCookieOptions(params.isProduction),
    maxAge: params.sessionDays * SECONDS_PER_DAY,
  };
}

export function getClearSessionCookieOptions(params: { isProduction: boolean }) {
  return {
    ...buildBaseCookieOptions(params.isProduction),
    maxAge: 0,
  };
}
