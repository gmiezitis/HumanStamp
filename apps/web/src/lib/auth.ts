import { prisma } from './prisma';
import { nanoid } from 'nanoid';
import nodemailer from 'nodemailer';

export interface MagicLinkTokenPayload {
  email: string;
  token: string;
}

export async function createMagicLink(email: string): Promise<string> {
  const token = nanoid(32);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  await prisma.magicLink.create({
    data: {
      email,
      token,
      expiresAt,
    },
  });

  return token;
}

export async function verifyMagicLink(token: string): Promise<string | null> {
  const link = await prisma.magicLink.findUnique({
    where: { token },
  });

  if (!link || link.usedAt || link.expiresAt < new Date()) {
    return null;
  }

  await prisma.magicLink.update({
    where: { id: link.id },
    data: { usedAt: new Date() },
  });

  return link.email;
}

export async function getOrCreateUser(email: string): Promise<{ id: string; email: string; name: string | null }> {
  let user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    user = await prisma.user.create({
      data: { email },
    });
  }

  return user;
}

export async function sendMagicLinkEmail(email: string, token: string): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const magicLink = `${baseUrl}/auth/verify?token=${token}`;

  const isDev = process.env.NODE_ENV !== 'production';

  if (isDev || !process.env.SMTP_HOST) {
    console.log('\n🔗 Magic link for', email);
    console.log('   ', magicLink);
    console.log('');
    return;
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM || 'noreply@humanstamp.app',
    to: email,
    subject: 'Sign in to Human Stamp',
    text: `Click this link to sign in: ${magicLink}\n\nThis link expires in 15 minutes.`,
    html: `
      <p>Click the link below to sign in:</p>
      <p><a href="${magicLink}">${magicLink}</a></p>
      <p>This link expires in 15 minutes.</p>
    `,
  });
}
