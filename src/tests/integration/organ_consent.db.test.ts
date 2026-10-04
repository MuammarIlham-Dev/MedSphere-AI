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

describe.skipIf(!DB_URL)('Organ consent integrity', () => {
  it('keeps citizen pledges pending and requires registry authority to grant', async () => {
    const patient = '90909090-1212-3434-5656-787878787878';
    const authority = '80808080-0101-2323-4545-676767676767';
    await sql!`DELETE FROM public.organ_consent_events WHERE donor_id IN (SELECT id FROM public.organ_donors WHERE profile_id IN (${patient},${authority}))`;
    await sql!`DELETE FROM public.organ_donors WHERE profile_id IN (${patient},${authority})`;
    await sql!`DELETE FROM public.profiles WHERE id IN (${patient},${authority})`;
    await sql!`DELETE FROM auth.users WHERE id IN (${patient},${authority})`;
    await sql!`INSERT INTO auth.users (id,email) VALUES (${patient},'organ-phase6-patient@medsphere.invalid'),(${authority},'organ-phase6-authority@medsphere.invalid')`;
    await sql!`INSERT INTO public.profiles (id,full_name,role,digital_health_id) VALUES (${patient},'Organ Patient','citizen','DHI-O6-PATIENT'),(${authority},'Registry Authority','organ_authority','DHI-O6-AUTH')`;
    const donor = await asUser<any[]>(patient, (tx) => tx`SELECT * FROM public.register_organ_donor_pledge('A+'::blood_group, ARRAY['kidney','liver']::organ_type[], '[]'::jsonb)`);
    expect(donor[0]?.consent).toBe('pending');
    let citizenError: any;
    try { await asUser(patient, (tx) => tx`SELECT * FROM public.update_organ_consent(${donor[0]?.id},'granted'::consent_status,NULL,'self grant')`); } catch (e) { citizenError = e; }
    expect(citizenError).toBeDefined();
    const granted = await asUser<any[]>(authority, (tx) => tx`SELECT * FROM public.update_organ_consent(${donor[0]?.id},'granted'::consent_status,NULL,'registry verified')`);
    expect(granted[0]?.consent).toBe('granted');
    const events = await sql!`SELECT event_type FROM public.organ_consent_events WHERE donor_id=${donor[0]?.id} ORDER BY created_at`;
    expect(events.map((e:any) => e.event_type)).toEqual(['pledged','granted']);
    await sql!`DELETE FROM public.organ_consent_events WHERE donor_id=${donor[0]?.id}`;
    await sql!`DELETE FROM public.organ_donors WHERE id=${donor[0]?.id}`;
    await sql!`DELETE FROM public.profiles WHERE id IN (${patient},${authority})`;
    await sql!`DELETE FROM auth.users WHERE id IN (${patient},${authority})`;
  });
});