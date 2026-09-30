import nodemailer from 'nodemailer';

export function requireEmailConfiguration() {
  if (!process.env.SMTP_HOST || !process.env.SMTP_FROM) {
    throw new Error('EMAIL_NOT_CONFIGURED');
  }
}

export async function sendEmail(message: {
  recipient: string;
  subject: string;
  body: string;
  id: string;
}) {
  requireEmailConfiguration();
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    ...(process.env.SMTP_USER
      ? { auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } }
      : {}),
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  const result = await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: message.recipient,
    subject: message.subject.replace(/[\r\n]/g, ' '),
    text: message.body,
    // Stable identifier across retries. SMTP is at-least-once, not exactly-once.
    messageId: `<humanstamp-${message.id}@${process.env
      .SMTP_FROM!.split('@')
      .pop()!
      .replace(/[<>\s]/g, '')}>`,
  });
  if (!result.accepted?.length || result.rejected?.length)
    throw new Error('EMAIL_REJECTED');
  return result.messageId as string;
}
