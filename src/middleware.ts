import { NextResponse, type NextRequest } from 'next/server';
import {
  evaluatePinAccess,
  PIN_COOKIE_NAME,
  resolveAuthConfig,
} from '@/lib/pin-auth';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/fonts/') ||
    pathname.startsWith('/icons/') ||
    pathname === '/api/pin' ||
    pathname === '/pin' ||
    pathname === '/offline' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sw.js'
  ) {
    return NextResponse.next();
  }

  const config = resolveAuthConfig(process.env);
  const sessionCookie = request.cookies.get(PIN_COOKIE_NAME)?.value;
  const evaluation = await evaluatePinAccess({
    configuredPin: config.configuredPin,
    authSecret: config.authSecret,
    sessionCookie,
    nodeEnv: config.isProduction ? 'production' : process.env.NODE_ENV,
    maxSessionDays: config.maxSessionDays,
  });

  if (!evaluation.allowed) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        {
          ok: false,
          error: evaluation.misconfigured
            ? 'AUTENTICAÇÃO NÃO CONFIGURADA EM PRODUÇÃO.'
            : 'NÃO AUTORIZADO. FAÇA LOGIN PARA CONTINUAR.',
        },
        { status: 401 },
      );
    }

    const pinUrl = new URL('/pin', request.url);
    pinUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(pinUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/).*)'],
};
