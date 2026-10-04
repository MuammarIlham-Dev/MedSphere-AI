import { describe, it, expect } from 'vitest';
import postgres from 'postgres';

const DB_URL = process.env.SUPABASE_DB_URL;
const sql = DB_URL ? postgres(DB_URL, { ssl: 'require' }) : null;

const patientId = '12121212-3434-5656-7878-909090909090';
const doctorId = '23232323-4545-6767-8989-101010101010';
const outsiderId = '34343434-5656-7878-9090-121212121212';
const pharmacyUserId = '45454545-6767-8989-1010-232323232323';
const pharmacyId = '56565656-7878-9090-1212-343434343434';
const appointmentId = '67676767-8989-1010-2323-454545454545';
const prescriptionId = '78787878-9090-1212-3434-565656565656';
const medicineId = '89898989-1010-2323-4545-676767676767';

async function asUser<T>(userId: string, fn: (tx: any) => Promise<T>) {
  if (!sql) throw new Error('SUPABASE_DB_URL is required');
  return sql.begin(async (tx) => {
    await tx`SET LOCAL ROLE authenticated`;
    await tx`SELECT set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: 'authenticated', aud: 'authenticated' })}, true)`;
    return fn(tx);
  });
}

describe.skipIf(!DB_URL)('Citizen EHR privacy integration', () => {
  it('blocks unrelated doctor/pharmacy access before an explicit share and permits it after sharing', async () => {
    await sql!`DELETE FROM public.prescription_pharmacy_shares WHERE prescription_id = ${prescriptionId}`;
    await sql!`DELETE FROM public.prescription_items WHERE prescription_id = ${prescriptionId}`;
    await sql!`DELETE FROM public.prescriptions WHERE id = ${prescriptionId}`;
    await sql!`DELETE FROM public.appointment_feedback WHERE appointment_id = ${appointmentId}`;
    await sql!`DELETE FROM public.appointments WHERE id = ${appointmentId}`;
    await sql!`DELETE FROM public.doctors WHERE id IN (${doctorId}, ${outsiderId})`;
    await sql!`DELETE FROM public.pharmacies WHERE id = ${pharmacyId}`;
    await sql!`DELETE FROM public.profiles WHERE id IN (${patientId}, ${doctorId}, ${outsiderId}, ${pharmacyUserId})`;
    await sql!`DELETE FROM auth.users WHERE id IN (${patientId}, ${doctorId}, ${outsiderId}, ${pharmacyUserId})`;

    await sql!`INSERT INTO auth.users (id,email) VALUES (${patientId},'ehr-phase3-patient@medsphere.invalid'),(${doctorId},'ehr-phase3-doctor@medsphere.invalid'),(${outsiderId},'ehr-phase3-outsider@medsphere.invalid'),(${pharmacyUserId},'ehr-phase3-pharmacy@medsphere.invalid')`;
    await sql!`INSERT INTO public.profiles (id,full_name,role,digital_health_id) VALUES (${patientId},'Phase3 Patient','citizen','DHI-P3-PATIENT'),(${doctorId},'Treating Doctor','doctor','DHI-P3-DOCTOR'),(${outsiderId},'Other Doctor','doctor','DHI-P3-OUTSIDER'),(${pharmacyUserId},'Pharmacy','pharmacy','DHI-P3-PHARMACY')`;
    await sql!`INSERT INTO public.doctors (id,profile_id,specialty,qualifications,experience_years,license_no,consultation_fee,verification,clinic_enabled,video_enabled) VALUES (${doctorId},${doctorId},'General Medicine',ARRAY['MBBS'],5,'P3-DOC-LIC',500,'verified',true,true),(${outsiderId},${outsiderId},'Cardiology',ARRAY['MBBS'],8,'P3-OUT-LIC',700,'verified',true,true)`;
    await sql!`INSERT INTO public.pharmacies (id,owner_id,name,license_no,verification) VALUES (${pharmacyId},${pharmacyUserId},'Phase3 Pharmacy','P3-PHARM-LIC','verified')`;
    await sql!`INSERT INTO public.appointments (id,patient_id,doctor_id,scheduled_at,duration_min,type,status,token_number,amount_charged) VALUES (${appointmentId},${patientId},${doctorId},NOW(),15,'clinic','completed',901,500)`;
    await sql!`INSERT INTO public.medicines (id,name,form,strength,manufacturer) VALUES (${medicineId},'Phase3 Medicine','tablet','500mg','MedSphere') ON CONFLICT (id) DO NOTHING`;
    await sql!`INSERT INTO public.prescriptions (id,appointment_id,patient_id,doctor_id,status,notes) VALUES (${prescriptionId},${appointmentId},${patientId},${doctorId},'active','Phase3 test')`;
    await sql!`INSERT INTO public.prescription_items (prescription_id,medicine_id,dosage,frequency,duration_days,instructions) VALUES (${prescriptionId},${medicineId},'1 tablet','twice daily',5,'After meals')`;

    const outsiderRows = await asUser(outsiderId, (tx) => tx`SELECT id FROM public.prescriptions WHERE id=${prescriptionId}`);
    expect(outsiderRows).toHaveLength(0);
    const pharmacyRows = await asUser(pharmacyUserId, (tx) => tx`SELECT id FROM public.prescriptions WHERE id=${prescriptionId}`);
    expect(pharmacyRows).toHaveLength(0);

    const share = await asUser(patientId, (tx) => tx`SELECT * FROM public.share_prescription_with_pharmacy(${prescriptionId},${pharmacyId})`);
    expect(share[0]?.status).toBe('shared');

    const pharmacyVisible = await asUser(pharmacyUserId, (tx) => tx`SELECT id FROM public.prescriptions WHERE id=${prescriptionId}`);
    expect(pharmacyVisible).toHaveLength(1);
    const fulfilled = await asUser(pharmacyUserId, (tx) => tx`SELECT status FROM public.fulfill_prescription_share(${share[0]?.id})`);
    expect(fulfilled[0]?.status).toBe('fulfilled');

    await sql!`DELETE FROM public.prescription_pharmacy_shares WHERE prescription_id=${prescriptionId}`;
    await sql!`DELETE FROM public.prescription_items WHERE prescription_id=${prescriptionId}`;
    await sql!`DELETE FROM public.prescriptions WHERE id=${prescriptionId}`;
    await sql!`DELETE FROM public.appointment_feedback WHERE appointment_id=${appointmentId}`;
    await sql!`DELETE FROM public.appointments WHERE id=${appointmentId}`;
    await sql!`DELETE FROM public.doctors WHERE id IN (${doctorId},${outsiderId})`;
    await sql!`DELETE FROM public.pharmacies WHERE id=${pharmacyId}`;
    await sql!`DELETE FROM public.profiles WHERE id IN (${patientId},${doctorId},${outsiderId},${pharmacyUserId})`;
    await sql!`DELETE FROM public.medicines WHERE id=${medicineId}`;
    await sql!`DELETE FROM auth.users WHERE id IN (${patientId},${doctorId},${outsiderId},${pharmacyUserId})`;
  });

  it('rejects feedback until the appointment is completed', async () => {
    await sql!`INSERT INTO public.appointments (id,patient_id,doctor_id,scheduled_at,duration_min,type,status,token_number,amount_charged) VALUES (${appointmentId},${patientId},${doctorId},NOW()+interval '1 day',15,'clinic','booked',902,500) ON CONFLICT (id) DO UPDATE SET status='booked'`;
    let error;
    try {
      await asUser(patientId, (tx) => tx`INSERT INTO public.appointment_feedback (appointment_id,rating,comment) VALUES (${appointmentId},5,'Too early')`);
    } catch (e) { error = e; }
    expect(error).toBeDefined();
    await sql!`DELETE FROM public.appointment_feedback WHERE appointment_id=${appointmentId}`;
    await sql!`DELETE FROM public.appointments WHERE id=${appointmentId}`;
  });
});