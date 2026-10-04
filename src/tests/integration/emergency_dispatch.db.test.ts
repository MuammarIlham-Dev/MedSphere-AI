import { describe, it, expect } from 'vitest';
import postgres from 'postgres';

const DB_URL = process.env.SUPABASE_DB_URL;
const sql = (DB_URL ? postgres(DB_URL, { ssl: 'require' }) : null) as unknown as postgres.Sql;

async function asUser<T>(userId: string, fn: (tx: any) => Promise<T>) {
  if (!sql) throw new Error('SUPABASE_DB_URL is required');
  return sql.begin(async (tx) => {
    await tx`SET LOCAL ROLE authenticated`;
    await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: 'authenticated', aud: 'authenticated' })}, true)`;
    return fn(tx);
  });
}

describe.skipIf(!DB_URL)('Emergency dispatch integrity', () => {
  it('rejects invalid ambulance coordinates before any location update', async () => {
    let error: any;
    try {
      await asUser('10101010-2020-3030-4040-505050505050', (tx) =>
        tx`SELECT public.update_ambulance_location(
          '20202020-3030-4040-5050-606060606060',
          120,
          181
        )`
      );
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(String(error?.message)).toMatch(/invalid coordinates/i);
  });

  it('rejects dispatch attempts from an ordinary authenticated user', async () => {
    let error: any;
    try {
      await asUser('30303030-4040-5050-6060-707070707070', (tx) =>
        tx`SELECT public.dispatch_emergency_ambulance(
          '40404040-5050-6060-7070-808080808080',
          '50505050-6060-7070-8080-909090909090'
        )`
      );
    } catch (e) {
      error = e;
    }
    expect(error).toBeDefined();
    expect(String(error?.message)).toMatch(/dispatch authority/i);
  });
});
