function timestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    console.log(JSON.stringify({ level: 'info', time: timestamp(), message, ...meta }));
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    console.warn(JSON.stringify({ level: 'warn', time: timestamp(), message, ...meta }));
  },
  error: (message: string, meta?: Record<string, unknown>) => {
    console.error(JSON.stringify({ level: 'error', time: timestamp(), message, ...meta }));
  },
};
