import { describe, it, expect, vi, beforeEach } from 'vitest';
import { organService } from './organ.service';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
    }
  }
}));

describe('organ.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registerDonor sets consent correctly using RPC', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null } as any);
    
    const mockUpsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'donor-123' }, error: null }) }) });
    vi.mocked(supabase.from).mockReturnValue({ upsert: mockUpsert } as any);
    vi.mocked(supabase.rpc).mockResolvedValue({ data: { id: 'donor-123', consent: 'pending' }, error: null } as any);

    await organService.registerDonor({
      has_consent: true,
      organs: ['heart', 'kidneys'],
      emergency_contact_name: 'Jane Doe',
      emergency_contact_phone: '123456789'
    } as any);

    expect(supabase.from).toHaveBeenCalledWith('organ_donors');
    expect(mockUpsert).toHaveBeenCalledWith({
      profile_id: 'u1',
      organs: ['heart', 'kidneys'],
      emergency_contact_name: 'Jane Doe',
      emergency_contact_phone: '123456789',
      has_consent: true
    }, { onConflict: 'profile_id' });

    expect(supabase.rpc).toHaveBeenCalledWith('update_organ_consent', {
      p_donor_id: 'donor-123',
      p_consent: 'pending',
      p_file_id: null
    });
  });

  it('withdrawConsent sets consent to withdrawn using RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValue({ data: { id: 'donor-123', consent: 'withdrawn' }, error: null } as any);

    await organService.withdrawConsent('donor-123');

    expect(supabase.rpc).toHaveBeenCalledWith('update_organ_consent', {
      p_donor_id: 'donor-123',
      p_consent: 'withdrawn'
    });
  });
});
