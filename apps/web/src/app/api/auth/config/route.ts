import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    demoLoginEnabled: process.env.DEMO_LOGIN === 'true',
  });
}
