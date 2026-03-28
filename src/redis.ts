import Redis from 'ioredis';
import { config } from './config';
import { logger } from './logger';

export function createRedisConnection(): Redis {
  const conn = new Redis(config.redis.url, { maxRetriesPerRequest: null });
  conn.on('error', (err) => {
    logger.warn('Redis connection error', { error: err.message });
  });
  return conn;
}
