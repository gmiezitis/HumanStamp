import { NextRequest, NextResponse } from 'next/server';
import { sign } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

// Test-only login route for E2E tests
export async function POST(request: NextRequest) {
  // Only allow in development/test
  if (process.env.NODE_ENV === 'production' && process.env.ALLOW_TEST_LOGIN !== 'true') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  const { email } = await request.json();

  // Find or create user
  let user = await prisma.user.findUnique({ where: { email } });
  
  if (!user) {
    user = await prisma.user.create({
      data: { email },
    });
  }

  // Create JWT
  const token = sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '7d' }
  );

  const response = NextResponse.json({ success: true, user });
  response.cookies.set('humanstamp_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });

  return response;
}
