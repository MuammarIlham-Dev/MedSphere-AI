import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import { publishBloodRealtime } from '@/services/bloodRealtime.service';
import type { BloodRequestCoverage, BloodBankDonorCommitment } from '@/types/bloodFulfillment';

export const bloodFulfillmentService = {
  coverage: (requestId: string) =>
    unwrap<BloodRequestCoverage[]>(
      supabase.rpc('get_blood_request_coverage', { p_request_id: requestId })
    ),

  bankDonorCommitments: (bankId: string) =>
    unwrap<BloodBankDonorCommitment[]>(
      supabase.rpc('get_blood_bank_donor_commitments', { p_bank_id: bankId })
    ),

  confirmDonorDonation: async (responseId: string, bankId: string, units = 1) => {
    const commitments = await bloodFulfillmentService.bankDonorCommitments(bankId);
    const requestId = commitments.find(item => item.response_id === responseId)?.request_id ?? null;
    const result = await unwrap<any>(
      supabase.rpc('confirm_broadcast_donor_donation', {
        p_response_id: responseId,
        p_bank_id: bankId,
        p_units: units,
      })
    );
    if (requestId) {
      void publishBloodRealtime(requestId, 'coverage_changed').catch(() => undefined);
    }
    return result;
  },
};
