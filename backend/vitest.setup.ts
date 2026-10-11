import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Every "today" calculation in the app is evaluated in this zone, so the
// suite must run in it too or the dashboard boundary tests become flaky.
process.env.TZ = 'Asia/Kolkata';
process.env.NODE_ENV = 'test';

// Load .env.test if present, without adding a dotenv dependency. Values
// already in the environment win, so CI can override any of them.
const envTestPath = resolve(import.meta.dirname, '.env.test');
if (existsSync(envTestPath)) {
  for (const line of readFileSync(envTestPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

// Defaults that let the suite run against a stock docker-compose stack with
// no .env.test file at all.
process.env.DATABASE_URL ??= 'postgresql://voucher:voucher@localhost:5432/voucher_test?schema=public';
process.env.JWT_SECRET ??= 'test-secret-that-is-at-least-32-characters-long';
process.env.UPLOAD_DIR ??= resolve(import.meta.dirname, 'tests/.uploads');
