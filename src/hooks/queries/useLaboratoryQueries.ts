import { useQuery, useMutation, useQueryClient } from'@tanstack/react-query';
import { supabase } from'@/lib/supabase';
import { unwrap } from'@/lib/api';

export function useLabOrders(labId?: string) {
 return useQuery({
 queryKey: ['lab-orders', labId],
 queryFn: async () => {
 const data = await unwrap<Array<{
    id: string;
    booked_at: string;
    patient?: { full_name: string };
    items?: Array<{ id: string; sample_status: string; test?: { name: string; code: string } }>;
  }>>(
 supabase
 .from('lab_orders')
 .select(`
 *,
 patient:patient_id(full_name),
 items:lab_order_items(
 *,
 test:test_id(name, code)
 )
 `)
 .eq('lab_id', labId ?? '')
 .in('status', ['pending','in_progress'])
 .order('booked_at', { ascending: false })
 );
 return data;
 },
 enabled: !!labId,
 });
}

export function useAdvanceSampleStatus() {
 const qc = useQueryClient();
 return useMutation({
 mutationFn: async ({ itemId, currentStatus }: { itemId: string, currentStatus: string }) => {
 const statuses = ['ordered','collected','in_transit','received','processing','analyzed'];
 const nextIdx = statuses.indexOf(currentStatus) + 1;
 const nextStatus = nextIdx < statuses.length ? statuses[nextIdx] : statuses[statuses.length - 1];
 
 return unwrap(
 supabase
 .from('lab_order_items')
 .update({ sample_status: nextStatus })
 .eq('id', itemId)
 );
 },
 onSuccess: () => {
 void qc.invalidateQueries({ queryKey: ['lab-orders'] });
 }
 });
}
