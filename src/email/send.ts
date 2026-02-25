import { config } from '../config';
import { logger } from '../logger';

type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
};

async function sendViaResend(opts: SendEmailOptions): Promise<void> {
  const { Resend } = await import('resend');
  const resend = new Resend(config.email.resend.apiKey);

  const { error } = await resend.emails.send({
    from: config.email.resend.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });

  if (error) {
    throw new Error(`Resend error: ${error.message}`);
  }
}

async function sendViaSMTP(opts: SendEmailOptions): Promise<void> {
  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: config.email.smtp.host,
    port: config.email.smtp.port,
    secure: config.email.smtp.port === 465,
    auth: {
      user: config.email.smtp.user,
      pass: config.email.smtp.pass,
    },
  });

  await transporter.sendMail({
    from: config.email.smtp.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
  });
}

export async function sendEmail(opts: SendEmailOptions): Promise<void> {
  logger.info('Sending email', { to: opts.to, subject: opts.subject, provider: config.email.provider });

  if (config.email.provider === 'resend') {
    await sendViaResend(opts);
  } else {
    await sendViaSMTP(opts);
  }

  logger.info('Email sent', { to: opts.to });
}
