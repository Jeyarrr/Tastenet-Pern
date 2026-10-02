import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { z } from 'zod';

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.env'), quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().url().refine(value => /^postgres(ql)?:/.test(value), 'Must be a PostgreSQL URL'),
  CLIENT_ORIGIN: z.string().url().optional(),
  SESSION_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  SESSION_COOKIE_NAME: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_-]*$/).default('tastenet_session')
});

export function readConfig(env = process.env) {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const fields = parsed.error.issues.map(issue => issue.path.join('.')).join(', ');
    throw new Error(`Invalid environment configuration: ${fields}`);
  }
  if (parsed.data.NODE_ENV === 'production' && !parsed.data.CLIENT_ORIGIN) {
    throw new Error('CLIENT_ORIGIN is required in production');
  }
  return parsed.data;
}
