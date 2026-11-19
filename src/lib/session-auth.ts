import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import {
  evaluatePinAccess,
  PIN_COOKIE_NAME,
  resolveAuthConfig,
} from '@/lib/pin-auth';

export class UnauthorizedSessionError extends Error {
  readonly status = 401;
  readonly misconfigured: boolean;

  constructor(
    message = 'NÃO AUTORIZADO. FAÇA LOGIN PARA CONTINUAR.',
    options?: { misconfigured?: boolean },
  ) {
    super(message);
    this.name = 'UnauthorizedSessionError';
    this.misconfigured = Boolean(options?.misconfigured);
  }
}

export type SessionAuthSource = NextRequest | string | undefined;

async function readSessionCookie(source?: SessionAuthSource): Promise<string | undefined> {
  if (typeof source === 'string') {
    return source;
  }
  if (source && typeof source === 'object' && 'cookies' in source) {
    return source.cookies.get(PIN_COOKIE_NAME)?.value;
  }
  const cookieStore = await cookies();
  return cookieStore.get(PIN_COOKIE_NAME)?.value;
}

export async function requireSessionAuth(source?: SessionAuthSource): Promise<void> {
  const config = resolveAuthConfig(process.env);

  if (config.isMisconfigured) {
    throw new UnauthorizedSessionError('AUTENTICAÇÃO NÃO CONFIGURADA EM PRODUÇÃO.', {
      misconfigured: true,
    });
  }

  if (!config.configuredPin) {
    return;
  }

  const sessionCookie = await readSessionCookie(source);
  const evaluation = await evaluatePinAccess({
    configuredPin: config.configuredPin,
    authSecret: config.authSecret,
    sessionCookie,
    nodeEnv: config.isProduction ? 'production' : process.env.NODE_ENV,
    maxSessionDays: config.maxSessionDays,
  });

  if (!evaluation.allowed) {
    throw new UnauthorizedSessionError(
      evaluation.misconfigured
        ? 'AUTENTICAÇÃO NÃO CONFIGURADA EM PRODUÇÃO.'
        : 'NÃO AUTORIZADO. FAÇA LOGIN PARA CONTINUAR.',
      { misconfigured: evaluation.misconfigured },
    );
  }
}
