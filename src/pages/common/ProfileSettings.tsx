import { useAuthStore } from '@/stores/authStore';
import { PageHeader } from '@/components/ui/KpiCard';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { IoPersonOutline, IoLocationOutline, IoHeartOutline } from 'react-icons/io5';
import { useUpdateProfile } from '@/hooks/queries/useProfileQueries';
import { type FormEvent, useState } from 'react';
import type { BloodGroup, Gender } from '@/types';

export default function ProfileSettings() {
  const profile = useAuthStore((s) => s.profile);
  const updateProfile = useUpdateProfile();

  // State to track which form is currently submitting
  const [activeForm, setActiveForm] = useState<'personal' | 'location' | 'health' | null>(null);
  
  const [heightUnit, setHeightUnit] = useState<'cm'|'m'|'ft-in'>('cm');
  const [weightUnit, setWeightUnit] = useState<'kg'|'lb'>('kg');

  if (!profile) return null;

  const handlePersonalSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setActiveForm('personal');
    const formData = new FormData(e.currentTarget);
    updateProfile.mutate(
      {
        full_name: formData.get('full_name') as string,
        dob: (formData.get('dob') as string) || null,
        gender: (formData.get('gender') as Gender) || null,
      },
      { onSettled: () => setActiveForm(null) }
    );
  };

  const handleLocationSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setActiveForm('location');
    const formData = new FormData(e.currentTarget);
    updateProfile.mutate(
      {
        phone: (formData.get('phone') as string) || null,
        city: (formData.get('city') as string) || null,
        address: (formData.get('address') as string) || null,
      },
      { onSettled: () => setActiveForm(null) }
    );
  };

  const handleHealthSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setActiveForm('health');
    const formData = new FormData(e.currentTarget);
    const blood_group = (formData.get('blood_group') as BloodGroup) || null;
    
    // Weight calculation
    const wVal = parseFloat(formData.get('weight') as string);
    const wUnit = formData.get('weight_unit') as string;
    let weight_kg = null;
    if (!isNaN(wVal)) {
      weight_kg = wUnit === 'lb' ? wVal / 2.20462 : wVal;
    }

    // Height calculation
    const hUnit = formData.get('height_unit') as string;
    let height_cm = null;
    if (hUnit === 'ft-in') {
      const ft = parseFloat(formData.get('height_ft') as string) || 0;
      const inch = parseFloat(formData.get('height_in') as string) || 0;
      if (ft > 0 || inch > 0) height_cm = (ft * 12 + inch) * 2.54;
    } else {
      const hVal = parseFloat(formData.get('height') as string);
      if (!isNaN(hVal)) {
        height_cm = hUnit === 'm' ? hVal * 100 : hVal;
      }
    }

    updateProfile.mutate(
      {
        blood_group,
        weight_kg,
        height_cm,
      },
      { onSettled: () => setActiveForm(null) }
    );
  };

  return (
    <div className="mx-auto max-w-4xl pb-10">
      <PageHeader title="Profile Settings" subtitle="Manage your personal information and preferences" />
      
      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2 space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <IoPersonOutline className="h-6 w-6 text-brand-600" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Personal Information</h2>
            </div>
            
            <form onSubmit={handlePersonalSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="full_name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Full Name</label>
                  <input required type="text" id="full_name" name="full_name" defaultValue={profile.full_name} className="mt-1 block w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-white/10 dark:text-white" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Digital Health ID</label>
                  <input type="text" defaultValue={profile.digital_health_id || 'Not assigned'} disabled className="mt-1 block w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:border-white/5 dark:bg-surface-dark-muted" />
                </div>
                <div>
                  <label htmlFor="dob" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Date of Birth</label>
                  <input type="date" id="dob" name="dob" defaultValue={profile.dob || ''} className="mt-1 block w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-white/10 dark:text-white" />
                </div>
                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Gender</label>
                  <select id="gender" name="gender" defaultValue={profile.gender || ''} className="mt-1 block w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-white/10 dark:text-white">
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <Button type="submit" loading={activeForm === 'personal'}>Save Changes</Button>
              </div>
            </form>
          </Card>

          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <IoLocationOutline className="h-6 w-6 text-brand-600" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Contact & Location</h2>
            </div>
            
            <form onSubmit={handleLocationSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="phone" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Phone Number</label>
                  <input type="tel" id="phone" name="phone" defaultValue={profile.phone || ''} className="mt-1 block w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-white/10 dark:text-white" />
                </div>
                <div>
                  <label htmlFor="city" className="block text-sm font-medium text-slate-700 dark:text-slate-300">City</label>
                  <input type="text" id="city" name="city" defaultValue={profile.city || ''} className="mt-1 block w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-white/10 dark:text-white" />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="address" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Address</label>
                  <textarea id="address" name="address" defaultValue={profile.address || ''} rows={3} className="mt-1 block w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-white/10 dark:text-white" />
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <Button type="submit" loading={activeForm === 'location'}>Save Location</Button>
              </div>
            </form>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-6">
              <IoHeartOutline className="h-6 w-6 text-brand-600" />
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Health Info</h2>
            </div>
            
            <form onSubmit={handleHealthSubmit}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="blood_group" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Blood Group</label>
                  <select id="blood_group" name="blood_group" defaultValue={profile.blood_group || ''} className="mt-1 block w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-white/10 dark:text-white">
                    <option value="">Unknown</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Weight</label>
                  <div className="mt-1 flex rounded-xl shadow-sm">
                    <input 
                      type="number" 
                      name="weight" 
                      step="0.1" 
                      defaultValue={profile.weight_kg ? (weightUnit === 'lb' ? (profile.weight_kg * 2.20462).toFixed(1) : profile.weight_kg) : ''}
                      className="block w-full min-w-0 flex-1 rounded-none rounded-l-xl border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-white/10 dark:text-white" 
                      placeholder="e.g. 70"
                    />
                    <select 
                      name="weight_unit" 
                      value={weightUnit}
                      onChange={(e) => setWeightUnit(e.target.value as 'kg'|'lb')}
                      className="inline-flex items-center rounded-none rounded-r-xl border border-l-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-500 dark:border-white/10 dark:bg-surface-dark-muted dark:text-slate-400"
                    >
                      <option value="kg">kg</option>
                      <option value="lb">lb</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Height</label>
                  <div className="mt-1 flex rounded-xl shadow-sm">
                    {heightUnit === 'ft-in' ? (
                      <>
                        <input 
                          type="number" 
                          name="height_ft" 
                          step="1" 
                          defaultValue={profile.height_cm ? Math.floor((profile.height_cm / 2.54) / 12) : ''}
                          className="block w-full min-w-0 flex-1 rounded-none rounded-l-xl border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-white/10 dark:text-white" 
                          placeholder="ft"
                        />
                        <input 
                          type="number" 
                          name="height_in" 
                          step="0.1" 
                          defaultValue={profile.height_cm ? Math.round((profile.height_cm / 2.54) % 12) : ''}
                          className="block w-full min-w-0 flex-1 rounded-none border border-l-0 border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-white/10 dark:text-white" 
                          placeholder="in"
                        />
                      </>
                    ) : (
                      <input 
                        type="number" 
                        name="height" 
                        step="0.1" 
                        defaultValue={profile.height_cm ? (heightUnit === 'm' ? (profile.height_cm / 100).toFixed(2) : profile.height_cm) : ''}
                        className="block w-full min-w-0 flex-1 rounded-none rounded-l-xl border border-slate-300 bg-transparent px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:ring-brand-500 dark:border-white/10 dark:text-white" 
                        placeholder={heightUnit === 'cm' ? "e.g. 175" : "e.g. 1.75"}
                      />
                    )}
                    <select 
                      name="height_unit" 
                      value={heightUnit}
                      onChange={(e) => setHeightUnit(e.target.value as 'cm'|'m'|'ft-in')}
                      className="inline-flex items-center rounded-none rounded-r-xl border border-l-0 border-slate-300 bg-slate-50 px-3 text-sm text-slate-500 dark:border-white/10 dark:bg-surface-dark-muted dark:text-slate-400"
                    >
                      <option value="cm">cm</option>
                      <option value="m">m</option>
                      <option value="ft-in">ft-in</option>
                    </select>
                  </div>
                </div>
              </div>
              
              <div className="mt-6 flex justify-end">
                <Button type="submit" loading={activeForm === 'health'}>Save Health Info</Button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </div>
  );
}
