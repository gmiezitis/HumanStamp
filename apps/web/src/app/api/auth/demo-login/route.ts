import { NextRequest, NextResponse } from 'next/server';
import { sign } from 'jsonwebtoken';
import { prisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  if (process.env.DEMO_LOGIN !== 'true') {
    return NextResponse.json({ error: 'Demo login not enabled' }, { status: 403 });
  }

  const demoUser = await prisma.user.findUnique({
    where: { email: 'demo@humanstamp.test' },
  });

  if (!demoUser) {
    return NextResponse.json({ 
      error: 'Demo user not found. Please run the seed script first.' 
    }, { status: 404 });
  }

  const token = sign(
    { userId: demoUser.id, email: demoUser.email },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: '7d' }
  );

  const response = NextResponse.json({ 
    success: true, 
    user: { id: demoUser.id, email: demoUser.email, name: demoUser.name } 
  });
  
  response.cookies.set('humanstamp_session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
  });

  return response;
}
