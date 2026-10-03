import { describe, it, expect, vi, beforeEach } from 'vitest';
import { organService } from './organ.service';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    }
  }
}));

describe('organ.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('registerDonor sets consent correctly', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null } as any);
    
    const mockUpsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { id: 'o1' }, error: null }) }) });
    vi.mocked(supabase.from).mockReturnValue({ upsert: mockUpsert } as any);

    await organService.registerDonor({
      has_consent: true,
      organs: ['heart', 'kidneys'],
      emergency_contact_name: 'Jane Doe',
      emergency_contact_phone: '123456789'
    } as any);

    expect(supabase.from).toHaveBeenCalledWith('organ_donors');
    expect(mockUpsert).toHaveBeenCalledWith({
      profile_id: 'u1',
      has_consent: true,
      consent: 'granted',
      organs: ['heart', 'kidneys'],
      emergency_contact_name: 'Jane Doe',
      emergency_contact_phone: '123456789'
    });
  });

  it('withdrawConsent sets consent to withdrawn and status inactive', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null } as any);
    const mockUpdate = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: vi.fn().mockResolvedValue({ data: { has_consent: false }, error: null }) }) }) });
    vi.mocked(supabase.from).mockReturnValue({ update: mockUpdate } as any);

    await organService.withdrawConsent('donor-123');

    expect(mockUpdate).toHaveBeenCalledWith({ consent: 'withdrawn', status: 'inactive' });
  });
});
