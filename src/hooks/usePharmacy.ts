import { useQuery, useMutation, useQueryClient } from'@tanstack/react-query';
import { supabase } from'@/lib/supabase';
import { unwrap } from'@/lib/api';

export function usePharmacyPrescriptions(pharmacyId?: string) {
 return useQuery({
 queryKey: ['pharmacy-prescriptions', pharmacyId],
 queryFn: async () => {
 // In a real app we would join with medicines, patients, and doctors
 // For now we just fetch the prescriptions and mock the rest if relations are missing
 const data = await unwrap<Array<{
   id: string;
   created_at: string;
   patient?: { full_name: string };
   doctor?: { specialty: string };
   items?: Array<{ id: string; medicine?: { name: string }; dosage: string; frequency: string; duration_days: number }>;
 }>>(
 supabase
 .from('prescriptions')
 .select(`
 *,
 patient:patient_id(full_name),
 doctor:doctor_id(specialty),
 items:prescription_items(
 *,
 medicine:medicine_id(name)
 )
 `)
 .eq('status','active')
 .order('created_at', { ascending: false })
 );
 return data;
 },
 enabled: !!pharmacyId,
 });
}

export function useFulfillPrescription() {
 const qc = useQueryClient();
 return useMutation({
 mutationFn: async ({ prescriptionId }: { prescriptionId: string }) => {
 return unwrap(
 supabase
 .from('prescriptions')
 .update({ status:'fulfilled' })
 .eq('id', prescriptionId)
 );
 },
 onSuccess: () => {
 void qc.invalidateQueries({ queryKey: ['pharmacy-prescriptions'] });
 }
 });
}
