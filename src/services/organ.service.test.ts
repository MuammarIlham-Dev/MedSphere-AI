import { describe, it, expect, vi, beforeEach } from 'vitest';
import { organService } from './organ.service';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe('organ.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registerDonor uses the authoritative donor pledge RPC', async () => {
    const mockDonor = {
      id: 'donor-123',
      profile_id: 'u1',
      blood_group: 'A+',
      organs: ['heart'],
      hla: [],
      consent: 'pending',
    };
    vi.mocked(supabase.rpc).mockResolvedValue({ data: mockDonor, error: null } as any);

    const result = await organService.registerDonor({
      blood_group: 'A+',
      organs: ['heart'],
      hla: [],
    });

    expect(supabase.rpc).toHaveBeenCalledWith('register_organ_donor_pledge', {
      p_blood_group: 'A+',
      p_organs: ['heart'],
      p_hla: [],
    });
    expect(result).toEqual(mockDonor);
  });

  it('withdrawConsent uses the dedicated consent-withdrawal RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { id: 'donor-123', consent: 'withdrawn' },
      error: null,
    } as any);

    await organService.withdrawConsent('donor-123');

    expect(supabase.rpc).toHaveBeenCalledWith('withdraw_organ_consent', {
      p_donor_id: 'donor-123',
    });
  });
});
