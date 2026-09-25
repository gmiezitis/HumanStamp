import { NextRequest, NextResponse } from 'next/server';
import { verifyMagicLink, getOrCreateUser } from '@/lib/auth';
import { createSessionToken } from '@/lib/session';
import { cookies } from 'next/headers';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    const email = await verifyMagicLink(token);
    if (!email) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const user = await getOrCreateUser(email);
    const sessionToken = createSessionToken(user.id, user.email);

    const cookieStore = await cookies();
    cookieStore.set('humanstamp_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60,
      path: '/',
    });

    return NextResponse.json({ success: true, user });
  } catch (error) {
    console.error('Verify error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
