import { NextResponse, type NextRequest } from 'next/server';
import { evaluatePinAccess, PIN_COOKIE_NAME } from '@/lib/pin-auth';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/fonts') ||
    pathname.startsWith('/api/pin') ||
    pathname === '/pin' ||
    pathname === '/manifest.webmanifest' ||
    pathname === '/favicon.ico'
  ) {
    return NextResponse.next();
  }

  const configuredPin = process.env.APP_ACCESS_PIN;
  const sessionCookie = request.cookies.get(PIN_COOKIE_NAME)?.value;
  const evaluation = evaluatePinAccess({ configuredPin, sessionCookie });

  if (!evaluation.allowed) {
    const pinUrl = new URL('/pin', request.url);
    pinUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(pinUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|fonts/).*)'],
};
