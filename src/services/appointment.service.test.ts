import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appointmentService } from './appointment.service';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    rpc: vi.fn(),
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    }
  }
}));

describe('appointment.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('valid booking passes correct duration to RPC', async () => {
    const mockRpc = vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: { id: 'app-123' }, error: null } as any);
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({ data: { user: { id: 'p1' } }, error: null } as any);
    
    await appointmentService.book({
      doctor_id: 'd1',
      hospital_id: 'h1',
      scheduled_at: '2026-10-03T10:00:00Z',
      type: 'video',
      duration_min: 30,
      reason: 'Checkup'
    });

    expect(mockRpc).toHaveBeenCalledWith('book_appointment', {
      p_doctor_id: 'd1',
      p_hospital_id: 'h1',
      p_scheduled_at: '2026-10-03T10:00:00Z',
      p_type: 'video',
      p_duration_min: 30,
      p_reason: 'Checkup'
    });
  });

  it('throws error if auth is missing', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({ data: { user: null }, error: null } as any);
    
    await expect(appointmentService.book({
      doctor_id: 'd1',
      hospital_id: 'h1',
      scheduled_at: '2026-10-03T10:00:00Z',
      type: 'video',
      duration_min: 30
    })).rejects.toThrow('Not signed in');
  });

  it('rejects unauthorized booking transition', async () => {
    const mockRpc = vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: null, error: new Error('Unauthorized') } as any);
    
    await expect(appointmentService.setStatus('app-123', 'completed')).rejects.toThrow('Unauthorized');
  });
});
