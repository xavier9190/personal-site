import { NextResponse, type NextRequest } from 'next/server';
import { createPinSessionToken, PIN_COOKIE_NAME, verifyPinInput } from '@/lib/pin-auth';

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as { pin?: string };
  const inputPin = body.pin ?? '';
  const configuredPin = process.env.APP_ACCESS_PIN;

  if (!verifyPinInput(inputPin, configuredPin)) {
    return NextResponse.json(
      { ok: false, error: 'PIN INVÁLIDO. TENTE NOVAMENTE.' },
      { status: 401 },
    );
  }

  const response = NextResponse.json({ ok: true });
  if (configuredPin?.trim()) {
    response.cookies.set(PIN_COOKIE_NAME, createPinSessionToken(configuredPin), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }
  return response;
}
