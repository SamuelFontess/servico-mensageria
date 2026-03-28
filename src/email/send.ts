import { config } from '../config';
import { logger } from '../logger';

type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
};

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  logger.info('Sending email', { to: opts.to, subject: opts.subject });

  const body = JSON.stringify({
    sender: { name: config.email.brevo.fromName, email: config.email.brevo.from },
    to: [{ email: opts.to }],
    subject: opts.subject,
    htmlContent: opts.html,
  });

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': config.email.brevo.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Brevo error ${res.status}: ${text}`);
  }

  logger.info('Email sent', { to: opts.to });
}
