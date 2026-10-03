import { describe, it, expect, vi, beforeEach } from 'vitest';
import { emergencyService } from './emergency.service';
import { supabase } from '@/lib/supabase';
import { publish } from '@/lib/ably';

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
    auth: {
      getUser: vi.fn(),
    }
  }
}));

vi.mock('@/lib/ably', () => ({
  publish: vi.fn(),
}));

describe('emergency.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('triggerSOS persists emergency via RPC and broadcasts to Ably', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValueOnce({ data: { user: { id: 'u1' } }, error: null } as any);
    
    const mockEmergency = { id: 'em-1', reporter_id: 'u1', lat: 10, lng: 20, type: 'medical' };
    vi.mocked(supabase.rpc).mockResolvedValue({ data: mockEmergency, error: null } as any);

    const result = await emergencyService.triggerSOS({ lat: 10, lng: 20, city: 'Dhaka' });

    expect(supabase.rpc).toHaveBeenCalledWith('trigger_emergency_sos', {
      p_lat: 10,
      p_lng: 20,
      p_type: 'medical',
    });
    
    expect(publish).toHaveBeenCalledWith('sos:Dhaka', 'sos:new', { emergency: mockEmergency });
    expect(result).toEqual(mockEmergency);
  });
});
