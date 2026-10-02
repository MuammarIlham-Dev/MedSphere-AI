import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { unwrap } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';
import type { Profile } from '@/types';

export function useUpdateProfile() {
  const toast = useUiStore((s) => s.toast);

  return useMutation({
    mutationFn: async (data: Partial<Profile>) => {
      const currentProfile = useAuthStore.getState().profile;
      if (!currentProfile) throw new Error('Not signed in');

      // If in dev bypass, just update the local store directly and pretend it worked
      if (import.meta.env.DEV && localStorage.getItem('dev_bypass') === '1') {
        // We simulate a network delay
        await new Promise(r => setTimeout(r, 500));
        useAuthStore.setState({ profile: { ...currentProfile, ...data } as Profile });
        return { ...currentProfile, ...data } as Profile;
      }

      const updated = await unwrap<Profile>(
        supabase
          .from('profiles')
          .update(data)
          .eq('id', currentProfile.id)
          .select()
          .single()
      );
      
      // Refresh global auth store so UI everywhere updates
      await useAuthStore.getState().refreshProfile();
      return updated;
    },
    onSuccess: () => {
      toast('success', 'Profile updated successfully');
    },
    onError: (err) => {
      toast('error', err instanceof Error ? err.message : 'Failed to update profile');
    },
  });
}
