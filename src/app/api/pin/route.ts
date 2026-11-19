import { NextResponse, type NextRequest } from 'next/server';
import {
  createPinSessionToken,
  getClearSessionCookieOptions,
  getSessionCookieOptions,
  PIN_COOKIE_NAME,
  resolveAuthConfig,
  resolveSessionDays,
  verifyPinInput,
} from '@/lib/pin-auth';
import { extractClientIp, loginRateLimiter } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  const config = resolveAuthConfig(process.env);

  if (config.isMisconfigured) {
    return NextResponse.json(
      {
        ok: false,
        error:
          'CONFIGURAÇÃO DE AUTENTICAÇÃO PENDENTE EM PRODUÇÃO (APP_ACCESS_PIN E AUTH_SECRET SÃO OBRIGATÓRIOS).',
      },
      { status: 503 },
    );
  }

  const clientIp = extractClientIp(request.headers);
  const rateCheck = loginRateLimiter.check(clientIp);
  if (rateCheck.blocked) {
    return NextResponse.json(
      {
        ok: false,
        error: 'MUITAS TENTATIVAS INVÁLIDAS. AGUARDE 15 MINUTOS PARA TENTAR NOVAMENTE.',
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateCheck.retryAfterSeconds),
        },
      },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    pin?: unknown;
    sessionDays?: unknown;
  };
  const inputPin = typeof body.pin === 'string' ? body.pin : '';

  if (!config.configuredPin) {
    // Non-production local dev with no PIN configured
    return NextResponse.json({ ok: true, sessionDays: config.defaultSessionDays });
  }

  const valid = await verifyPinInput(inputPin, config.configuredPin);
  if (!valid) {
    loginRateLimiter.recordFailure(clientIp);
    return NextResponse.json(
      { ok: false, error: 'CREDENCIAL INVÁLIDA. TENTE NOVAMENTE.' },
      { status: 401 },
    );
  }

  loginRateLimiter.reset(clientIp);

  const sessionDays = resolveSessionDays(body.sessionDays, {
    defaultSessionDays: config.defaultSessionDays,
    maxSessionDays: config.maxSessionDays,
  });

  const token = await createPinSessionToken({
    configuredPin: config.configuredPin,
    authSecret: config.authSecret,
    sessionDays,
    maxSessionDays: config.maxSessionDays,
  });

  const response = NextResponse.json({ ok: true, sessionDays });
  response.cookies.set(
    PIN_COOKIE_NAME,
    token,
    getSessionCookieOptions({
      sessionDays,
      isProduction: config.isProduction,
    }),
  );
  return response;
}

export async function DELETE() {
  const config = resolveAuthConfig(process.env);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    PIN_COOKIE_NAME,
    '',
    getClearSessionCookieOptions({ isProduction: config.isProduction }),
  );
  return response;
}
