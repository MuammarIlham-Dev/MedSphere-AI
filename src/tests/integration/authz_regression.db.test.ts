import { describe, it, expect, afterAll } from 'vitest';
import postgres from 'postgres';

const DB_URL = process.env.SUPABASE_DB_URL;
const sql = (DB_URL ? postgres(DB_URL) : null) as unknown as postgres.Sql;

const citizenId = 'a1a1a1a1-1111-4111-8111-111111111111';
const privilegedSignupId = 'b2b2b2b2-2222-4222-8222-222222222222';

async function asUser<T>(userId: string, fn: (tx: any) => Promise<T>) {
  if (!sql) throw new Error('SUPABASE_DB_URL is required');
  return sql.begin(async (tx) => {
    await tx`SET LOCAL ROLE authenticated`;
    await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({
      sub: userId,
      role: 'authenticated',
      aud: 'authenticated',
    })}, true)`;
    return fn(tx);
  });
}

describe.skipIf(!DB_URL)('P0 authorization regression', () => {
  afterAll(async () => {
    if (!sql) return;
    await sql`DELETE FROM auth.users WHERE id IN (${citizenId}, ${privilegedSignupId})`;
    await sql.end();
  });

  it('forces privileged signup metadata to a citizen profile', async () => {
    await sql!`DELETE FROM auth.users WHERE id IN (${citizenId}, ${privilegedSignupId})`;

    await sql!`INSERT INTO auth.users (
      id, email, raw_user_meta_data
    ) VALUES (
      ${privilegedSignupId},
      'p0-role-escalation@medsphere.invalid',
      ${JSON.stringify({ role: 'admin', full_name: 'Escalation Test' })}
    )`;

    const rows = await sql!`SELECT role, requested_role FROM public.profiles WHERE id=${privilegedSignupId}`;
    expect(rows).toHaveLength(1);
    expect(rows[0].role).toBe('citizen');
    expect(rows[0].requested_role).toBeNull();
  });

  it('blocks a citizen from changing their operational role directly', async () => {
    await sql!`INSERT INTO auth.users (
      id, email, raw_user_meta_data
    ) VALUES (
      ${citizenId},
      'p0-direct-role-change@medsphere.invalid',
      ${JSON.stringify({ role: 'citizen', full_name: 'Citizen Test' })}
    ) ON CONFLICT (id) DO NOTHING`;

    let error: unknown;
    try {
      await asUser(citizenId, (tx) =>
        tx`UPDATE public.profiles SET role='admin'::public.app_role WHERE id=${citizenId}`
      );
    } catch (e) {
      error = e;
    }

    expect(error).toBeDefined();

    const rows = await sql!`SELECT role FROM public.profiles WHERE id=${citizenId}`;
    expect(rows[0]?.role).toBe('citizen');
  });
});
