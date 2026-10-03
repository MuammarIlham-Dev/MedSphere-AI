import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ehrService } from './ehr.service';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  }
}));

describe('ehr.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('labReports maps lab tests correctly if empty', async () => {
    const mockSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue({ data: [], error: null }) }) });
    vi.mocked(supabase.from).mockReturnValue({ select: mockSelect } as any);

    const res = await ehrService.labReports('patient-1');
    expect(res).toEqual([]);
    expect(supabase.from).toHaveBeenCalledWith('lab_orders');
  });

  it('recordConsultation calls rpc correctly', async () => {
    const mockRpc = vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: 'record-123', error: null } as any);

    await ehrService.recordConsultation({
      appointmentId: 'app-1',
      title: 'Fever check',
      diagnosis: 'Flu',
      notes: 'Rest and drink fluids',
      prescriptionNotes: 'Paracetamol',
      prescriptionItems: []
    });

    expect(mockRpc).toHaveBeenCalledWith('record_consultation', {
      p_appointment_id: 'app-1',
      p_title: 'Fever check',
      p_diagnosis: 'Flu',
      p_notes: 'Rest and drink fluids',
      p_prescription_notes: 'Paracetamol'
    });
  });
});
