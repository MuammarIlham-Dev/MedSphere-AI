import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ehrService } from './ehr.service';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: { from: vi.fn(), rpc: vi.fn() }
}));

describe('ehr.service', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps an empty lab report result safely', async () => {
    const limit = vi.fn().mockResolvedValue({ data: [], error: null });
    const eq = vi.fn().mockReturnValue({ limit });
    const select = vi.fn().mockReturnValue({ eq });
    (supabase.from as unknown as ReturnType<typeof vi.fn>).mockReturnValue({ select });
    await expect(ehrService.labReports('patient-1')).resolves.toEqual([]);
    expect(supabase.from).toHaveBeenCalledWith('lab_orders');
  });

  it('sends the structured encounter payload to the canonical RPC', async () => {
    const mockRpc = (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: 'record-123', error: null });
    await ehrService.recordConsultation({
      appointmentId: 'app-1',
      title: 'Consultation note',
      diagnosis: 'Flu',
      notes: 'Rest',
      prescriptionNotes: 'Take after food',
      prescriptionItems: [],
      vitals: { temperature_c: 38.2, heart_rate_bpm: 96 },
      subjectiveNotes: 'Fever for two days',
      objectiveNotes: 'Febrile',
      assessmentNotes: 'Likely viral illness',
      carePlan: 'Hydration and rest',
      followUpAt: null,
      followUpInstructions: '',
    });
    expect(mockRpc).toHaveBeenCalledWith('record_consultation', expect.objectContaining({
      p_appointment_id: 'app-1',
      p_vitals: { temperature_c: 38.2, heart_rate_bpm: 96 },
      p_subjective_notes: 'Fever for two days',
      p_assessment_notes: 'Likely viral illness',
    }));
  });

  it('creates a lab order through the protected encounter RPC', async () => {
    const mockRpc = (supabase.rpc as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { id: 'order-1' }, error: null });
    await ehrService.createLabOrder({
      appointmentId: 'app-1', labId: 'lab-1', priority: 'high', testIds: ['test-1']
    });
    expect(mockRpc).toHaveBeenCalledWith('create_lab_order_for_encounter', {
      p_appointment_id: 'app-1',
      p_lab_id: 'lab-1',
      p_priority: 'high',
      p_test_ids: ['test-1'],
    });
  });
});
