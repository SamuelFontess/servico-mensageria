import 'dotenv/config';

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optionalInt(key: string, fallback: number): number {
  const val = parseInt(process.env[key] ?? '', 10);
  return isFinite(val) && val > 0 ? val : fallback;
}

const emailProvider = (process.env.EMAIL_PROVIDER ?? 'resend') as 'resend' | 'smtp';

if (emailProvider === 'resend') {
  required('RESEND_API_KEY');
  required('RESEND_FROM');
} else if (emailProvider === 'smtp') {
  required('SMTP_HOST');
  required('SMTP_USER');
  required('SMTP_PASS');
  required('SMTP_FROM');
} else {
  throw new Error(`Invalid EMAIL_PROVIDER: "${emailProvider}". Must be "resend" or "smtp".`);
}

export const config = {
  redis: {
    url: required('REDIS_URL'),
  },
  ws: {
    heartbeatIntervalMs: optionalInt('WS_HEARTBEAT_INTERVAL_MS', 30_000),
  },
  http: {
    port: optionalInt('PORT', 3002),
    adminApiKey: required('ADMIN_API_KEY'),
  },
  email: {
    provider: emailProvider,
    resend: {
      apiKey: process.env.RESEND_API_KEY ?? '',
      from: process.env.RESEND_FROM ?? '',
    },
    smtp: {
      host: process.env.SMTP_HOST ?? '',
      port: optionalInt('SMTP_PORT', 587),
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? '',
      from: process.env.SMTP_FROM ?? '',
    },
  },
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
};
