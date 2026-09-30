import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendEmail } from '../lib/email';

const mail = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => mail) },
}));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});
describe('Honest SMTP results', () => {
  const message = {
    id: 'fixed-id',
    recipient: 'client@example.test',
    subject: 'Review\r\nrequested',
    body: 'Exact version 1',
  };
  it('requires real configuration even in development', async () => {
    vi.stubEnv('SMTP_HOST', '');
    await expect(sendEmail(message)).rejects.toThrow('EMAIL_NOT_CONFIGURED');
    expect(mail.sendMail).not.toHaveBeenCalled();
  });
  it('reports provider acceptance with a stable retry identifier', async () => {
    vi.stubEnv('SMTP_HOST', 'localhost');
    vi.stubEnv('SMTP_FROM', 'no-reply@example.test');
    mail.sendMail.mockResolvedValue({
      accepted: ['client@example.test'],
      rejected: [],
      messageId: 'accepted-id',
    });
    expect(await sendEmail(message)).toBe('accepted-id');
    expect(mail.sendMail.mock.calls[0][0].subject).toBe('Review  requested');
    expect(mail.sendMail.mock.calls[0][0].messageId).toBe(
      '<humanstamp-fixed-id@example.test>'
    );
  });
  it('does not call rejected mail a success', async () => {
    vi.stubEnv('SMTP_HOST', 'localhost');
    vi.stubEnv('SMTP_FROM', 'no-reply@example.test');
    mail.sendMail.mockResolvedValue({
      accepted: [],
      rejected: ['client@example.test'],
    });
    await expect(sendEmail(message)).rejects.toThrow('EMAIL_REJECTED');
  });
});
