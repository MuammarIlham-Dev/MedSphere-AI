import { describe, it, expect, vi, beforeEach } from 'vitest';
import { bloodService } from './blood.service';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    }
  }
}));

describe('blood.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registerAsDonor updates donor eligibility in database', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null } as any);
    
    const mockUpsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'd1' }, error: null }) }) });
    vi.mocked(supabase.from).mockReturnValue({ upsert: mockUpsert } as any);

    await bloodService.registerAsDonor({ blood_group: 'A+', is_available: true });

    expect(supabase.from).toHaveBeenCalledWith('blood_donors');
    expect(mockUpsert).toHaveBeenCalledWith({
      profile_id: 'u1',
      blood_group: 'A+',
      is_eligible: true
    }, { onConflict: 'profile_id' });
  });

  it('routes physical inventory changes through the authorized RPC', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: { bank_id: 'b1', blood_group: 'A+', units_available: 8, units_reserved: 2 },
      error: null
    });
    vi.mocked(supabase.rpc).mockImplementation(mockRpc as any);

    await bloodService.upsertInventory([{ bank_id: 'b1', blood_group: 'A+', units_available: 8 }]);

    expect(mockRpc).toHaveBeenCalledWith('set_blood_inventory', {
      p_bank_id: 'b1',
      p_blood_group: 'A+',
      p_units_available: 8
    });
  });

  it('createRequest filters out incorrect urgency mapping', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null } as any);
    const mockInsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'req1' }, error: null }) }) });
    vi.mocked(supabase.from).mockReturnValue({ insert: mockInsert } as any);

    await bloodService.createRequest({
      patient_name: 'John Doe',
      blood_group: 'O-',
      units: 2,
      urgency: 'critical' // Must pass correct Enum
    });

    expect(mockInsert).toHaveBeenCalledWith({
      patient_name: 'John Doe',
      blood_group: 'O-',
      units: 2,
      urgency: 'critical',
      requester_id: 'u1'
    });
  });
});
