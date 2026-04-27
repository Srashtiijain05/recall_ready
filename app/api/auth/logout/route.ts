import { NextRequest, NextResponse } from 'next/server';
import { clearSession } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    await clearSession();
  } catch (error) {
    console.error('Logout error:', error);
  }

  const response = NextResponse.redirect(new URL('/', req.url));
  // Ensure cookie is cleared in the response
  response.cookies.set('auth_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return response;
}
