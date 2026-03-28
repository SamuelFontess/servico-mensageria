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
    // Comma-separated list of allowed IPs for Bull Board (optional).
    // If empty, any IP with valid credentials can access it.
    bullBoardAllowedIps: process.env.BULL_BOARD_ALLOWED_IPS ?? '',
  },
  email: {
    brevo: {
      apiKey: required('BREVO_API_KEY'),
      from: required('BREVO_FROM'),
      fromName: process.env.BREVO_FROM_NAME ?? 'Driver App',
    },
  },
  frontendUrl: process.env.FRONTEND_URL ?? 'http://localhost:3001',
};
