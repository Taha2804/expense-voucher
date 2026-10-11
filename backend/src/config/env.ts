import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';

/**
 * Load .env before parsing. Node 22 can do this itself, so the project needs
 * no dotenv dependency. Values already in the environment win, which is what
 * lets the test setup and a container override the file.
 */
function loadDotEnv(): void {
  const envFile = resolve(process.cwd(), '.env');
  if (!existsSync(envFile)) return;
  try {
    process.loadEnvFile(envFile);
  } catch {
    // A malformed .env should not take the process down before the schema has
    // had a chance to report what is actually missing.
  }
}

loadDotEnv();

/**
 * The environment contract. Parsed once at import time so that a missing or
 * malformed variable is a boot failure with a readable message, rather than a
 * 500 the first time a request happens to touch it.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  UPLOAD_DIR: z.string().default('uploads/signatures'),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(2_097_152),
  TZ: z.string().default('Asia/Kolkata'),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    console.error('Invalid environment configuration:');
    for (const issue of parsed.error.issues) {
      console.error(`  ${issue.path.join('.')}: ${issue.message}`);
    }
    console.error('See .env.example for the full list of variables.');
    process.exit(1);
  }

  return parsed.data;
}

export const env: Env = loadEnv();

export const isProduction = env.NODE_ENV === 'production';
