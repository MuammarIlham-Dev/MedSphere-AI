import React, { useState } from 'react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useUiStore } from '@/stores/uiStore';

export function DoctorProfileSettings({ doctor }: { doctor: any }) {
  const [formData, setFormData] = useState({
    specialty: doctor.specialty || '',
    bio: doctor.bio || '',
    qualifications: doctor.qualifications?.join(', ') || '',
    languages: doctor.languages?.join(', ') || '',
    consultation_fee: doctor.consultation_fee || 0,
  });

  const queryClient = useQueryClient();
  const { session } = useAuth();
  const toast = useUiStore((s: any) => s.toast);

  const updateProfile = useMutation({
    mutationFn: async (data: typeof formData) => {
      const payload = {
        specialty: data.specialty,
        bio: data.bio,
        qualifications: data.qualifications.split(',').map((s: string) => s.trim()).filter(Boolean),
        languages: data.languages.split(',').map((s: string) => s.trim()).filter(Boolean),
        consultation_fee: Number(data.consultation_fee)
      };

      const { error } = await supabase
        .from('doctors')
        .update(payload)
        .eq('id', doctor.id)
        .eq('profile_id', session?.user.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-doctor'] });
      toast('success', 'Profile updated successfully');
    },
    onError: (err: any) => {
      toast('error', err.message);
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate(formData);
  };

  return (
    <Card className="mt-6">
      <CardHeader title="Professional Profile" subtitle="Update your public information and consultation fees" />
      <div className="p-6">
        <form onSubmit={handleSubmit} className="space-y-4 max-w-xl">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Specialty</label>
            <input 
              type="text" 
              value={formData.specialty} 
              onChange={e => setFormData({ ...formData, specialty: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:bg-surface-dark dark:border-white/10"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Qualifications (comma separated)</label>
            <input 
              type="text" 
              value={formData.qualifications} 
              onChange={e => setFormData({ ...formData, qualifications: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:bg-surface-dark dark:border-white/10"
              placeholder="e.g. MBBS, MD, FRCS"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Languages (comma separated)</label>
            <input 
              type="text" 
              value={formData.languages} 
              onChange={e => setFormData({ ...formData, languages: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:bg-surface-dark dark:border-white/10"
              placeholder="e.g. English, Spanish"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Consultation Fee ($)</label>
            <input 
              type="number" 
              min="0"
              value={formData.consultation_fee} 
              onChange={e => setFormData({ ...formData, consultation_fee: parseInt(e.target.value) || 0 })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:bg-surface-dark dark:border-white/10"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Professional Bio</label>
            <textarea 
              value={formData.bio} 
              onChange={e => setFormData({ ...formData, bio: e.target.value })}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:bg-surface-dark dark:border-white/10 h-24"
              placeholder="Tell patients about your expertise..."
            />
          </div>
          <div className="pt-2">
            <Button type="submit" disabled={updateProfile.isPending}>
              {updateProfile.isPending ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </form>
      </div>
    </Card>
  );
}
