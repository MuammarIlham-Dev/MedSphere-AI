import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';

export interface PharmacyPrescription {
  id: string;
  created_at: string;
  updated_at: string;
  status: string;
  share_id: string;
  share_status: 'shared' | 'accepted' | 'fulfilled';
  share_updated_at: string;
  doctor?: { specialty: string };
  items?: Array<{
    id: string;
    medicine?: { name: string };
    dosage: string;
    frequency: string;
    duration_days: number;
  }>;
}

export function usePharmacyPrescriptions(pharmacyId?: string) {
  return useQuery({
    queryKey: ['pharmacy-prescriptions', pharmacyId],
    queryFn: async () => {
      if (!pharmacyId) return [];

      const shares = await unwrap<Array<{
        id: string;
        prescription_id: string;
        status: 'shared' | 'accepted' | 'fulfilled';
        updated_at: string;
      }>>(
        supabase.from('prescription_pharmacy_shares')
          .select('id, prescription_id, status, updated_at')
          .eq('pharmacy_id', pharmacyId)
          .in('status', ['shared', 'accepted', 'fulfilled'])
          .order('updated_at', { ascending: false })
          .limit(100)
      );

      const ids = Array.from(new Set(shares.map((share) => share.prescription_id)));
      if (ids.length === 0) return [];

      const prescriptions = await unwrap<any[]>(
        supabase.from('prescriptions')
          .select(`
            id, created_at, updated_at, status,
            doctor:doctor_id(specialty),
            items:prescription_items(
              id, dosage, frequency, duration_days,
              medicine:medicine_id(name)
            )
          `)
          .in('id', ids)
          .order('created_at', { ascending: false })
      );

      const byId = new Map(prescriptions.map((prescription) => [prescription.id, prescription]));
      return shares
        .map((share) => {
          const prescription = byId.get(share.prescription_id);
          if (!prescription) return null;
          return {
            ...prescription,
            share_id: share.id,
            share_status: share.status,
            share_updated_at: share.updated_at,
          } satisfies PharmacyPrescription;
        })
        .filter((value): value is PharmacyPrescription => value !== null);
    },
    enabled: !!pharmacyId,
  });
}

export function useFulfillPrescription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ shareId }: { shareId: string }) =>
      unwrap(supabase.rpc('fulfill_prescription_share', { p_share_id: shareId })),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['pharmacy-prescriptions'] });
    },
  });
}
