import request from 'supertest';
import type { Express } from 'express';
import { DEFAULT_PASSWORD } from './factories.js';

/**
 * Log in and return a Supertest agent that carries the session cookie, so a
 * test reads like the sequence of requests a real client makes.
 */
export async function loginAs(
  app: Express,
  email: string,
  password: string = DEFAULT_PASSWORD,
): Promise<ReturnType<typeof request.agent>> {
  const agent = request.agent(app);
  const res = await agent.post('/api/auth/login').send({ email, password });

  if (res.status !== 200) {
    throw new Error(`loginAs(${email}) failed: ${res.status} ${JSON.stringify(res.body)}`);
  }

  return agent;
}
