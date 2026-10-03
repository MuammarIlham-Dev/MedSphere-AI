import React, { useState, useEffect } from 'react';
import { useOrganDonorProfile, useRegisterDonor, useWithdrawOrganConsent } from '@/hooks/queries/useOrganQueries';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { BloodGroup, OrganType } from '@/types';
import { Heart, Activity, FileText, ShieldAlert } from 'lucide-react';
import { PageHeader } from '@/components/ui/KpiCard';
import { PageTransition } from '@/components/transitions/PageTransition';
import { Badge } from '@/components/ui/Badge';

const AVAILABLE_ORGANS: { id: OrganType, label: string }[] = [
  { id: 'heart', label: 'Heart' },
  { id: 'kidney', label: 'Kidneys' },
  { id: 'liver', label: 'Liver' },
  { id: 'lung', label: 'Lungs' },
  { id: 'pancreas', label: 'Pancreas' },
  { id: 'cornea', label: 'Corneas' },
  { id: 'bone_marrow', label: 'Bone Marrow' }
];

export default function OrganDonation() {
  const profile = useAuthStore(s => s.profile);
  const { data: donorProfile, isLoading } = useOrganDonorProfile();
  const { mutate: register, isPending: isRegistering } = useRegisterDonor();
  const { mutate: withdraw, isPending: isWithdrawing } = useWithdrawOrganConsent();

  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>('');
  const [selectedOrgans, setSelectedOrgans] = useState<OrganType[]>([]);
  const [hasConsent, setHasConsent] = useState(false);
  const [nokContact, setNokContact] = useState('');

  // Pre-fill form if donor profile exists or user profile has blood group
  useEffect(() => {
    if (donorProfile) {
      setBloodGroup(donorProfile.blood_group);
      setSelectedOrgans(donorProfile.organs || []);
      setHasConsent(donorProfile.consent === 'granted' || donorProfile.consent === 'pending');
    } else if (profile?.blood_group) {
      setBloodGroup(profile.blood_group);
    }
  }, [donorProfile, profile]);

  const toggleOrgan = (organ: OrganType) => {
    setSelectedOrgans(prev => 
      prev.includes(organ) ? prev.filter(o => o !== organ) : [...prev, organ]
    );
  };

  const selectAllOrgans = () => {
    setSelectedOrgans(AVAILABLE_ORGANS.map(o => o.id));
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bloodGroup || selectedOrgans.length === 0 || !hasConsent) return;
    
    register({
      blood_group: bloodGroup as BloodGroup,
      organs: selectedOrgans,
      // For MVP we just use 'granted' via the service automatically if we pass a dummy consent_file_id
      // In production, an actual PDF/signature upload is required.
      consent_file_id: 'digital_signature_' + Date.now(),
      hla: []
    });
  };

  if (isLoading) return <div className="p-8 text-center text-slate-400">Loading donor profile...</div>;

  const isActiveDonor = donorProfile && donorProfile.status === 'active' && donorProfile.consent !== 'withdrawn';

  return (
    <PageTransition>
      <div className="max-w-4xl mx-auto space-y-6 p-6">
        <PageHeader 
          title="Organ Donation Registry" 
          subtitle="Pledge to save lives by becoming a registered organ donor."
        />

        {isActiveDonor ? (
          <div className="bg-emerald-900/20 border border-emerald-500/30 rounded-xl p-8 relative overflow-hidden">
            <div className="absolute -right-10 -top-10 opacity-10">
              <Heart className="w-64 h-64 text-emerald-500" />
            </div>
            
            <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Badge tone="success">Registered Donor</Badge>
                  <span className="text-sm text-slate-400">ID: {donorProfile?.id.split('-')[0]?.toUpperCase()}</span>
                </div>
                <h2 className="text-3xl font-bold text-slate-100">{profile?.full_name ?? 'User'}</h2>
                <p className="text-emerald-400 font-medium mt-1">Blood Group: {donorProfile?.blood_group}</p>
                
                <div className="mt-6 space-y-2">
                  <p className="text-sm text-slate-400">Pledged Organs:</p>
                  <div className="flex flex-wrap gap-2">
                    {donorProfile?.organs.map(o => (
                      <span key={o} className="px-3 py-1 bg-slate-800 text-slate-300 text-sm rounded-full border border-slate-700 capitalize">
                        {o}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              <div className="bg-slate-900/80 p-5 rounded-xl border border-slate-700 w-full md:w-64">
                <div className="flex items-center gap-2 mb-3 text-amber-400">
                  <ShieldAlert className="w-5 h-5" />
                  <span className="font-semibold text-sm">Manage Consent</span>
                </div>
                <p className="text-xs text-slate-400 mb-4">
                  You can update your pledge or withdraw your consent at any time. Withdrawal removes you from the active matching pool immediately.
                </p>
                <Button 
                  variant="danger" 
                  size="sm" 
                  className="w-full"
                  loading={isWithdrawing}
                  onClick={() => donorProfile && withdraw(donorProfile.id)}
                >
                  Withdraw Consent
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <div className="p-6 bg-slate-900/50 border-b border-slate-700 flex items-center gap-4">
              <div className="p-3 bg-rose-500/10 rounded-full">
                <Heart className="w-8 h-8 text-rose-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-100">Register as an Organ Donor</h2>
                <p className="text-sm text-slate-400">One donor can save up to 8 lives.</p>
              </div>
            </div>

            <form onSubmit={handleRegister} className="p-6 space-y-8">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Blood Group</label>
                  <select
                    required
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
                  >
                    <option value="">Select Blood Group</option>
                    {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Next of Kin Contact (Optional)</label>
                  <input
                    type="text"
                    placeholder="Emergency Contact Phone"
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-200 focus:border-brand-500 focus:ring-1 focus:ring-brand-500"
                    value={nokContact}
                    onChange={(e) => setNokContact(e.target.value)}
                  />
                  <p className="text-xs text-slate-500 mt-1">We recommend informing your family of your decision.</p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-4">
                  <label className="block text-sm font-medium text-slate-300">Select Organs to Donate</label>
                  <button type="button" onClick={selectAllOrgans} className="text-sm text-brand-400 hover:text-brand-300">
                    Select All
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {AVAILABLE_ORGANS.map(organ => (
                    <button
                      key={organ.id}
                      type="button"
                      onClick={() => toggleOrgan(organ.id)}
                      className={`p-3 rounded-lg border text-sm font-medium transition-all ${
                        selectedOrgans.includes(organ.id) 
                          ? 'bg-brand-500/20 border-brand-500 text-brand-400' 
                          : 'bg-slate-900 border-slate-700 text-slate-400 hover:border-slate-500'
                      }`}
                    >
                      {organ.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-slate-900/50 p-5 rounded-lg border border-slate-700">
                <h3 className="font-medium text-slate-200 flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-slate-400" />
                  Legal Consent
                </h3>
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="flex-shrink-0 mt-0.5">
                    <input 
                      type="checkbox" 
                      required
                      checked={hasConsent}
                      onChange={(e) => setHasConsent(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-brand-500 focus:ring-brand-500"
                    />
                  </div>
                  <span className="text-sm text-slate-300 group-hover:text-slate-200 transition-colors">
                    I hereby pledge to donate the selected organs for transplantation after my death. 
                    I confirm that this decision is made voluntarily. I understand that my family will be 
                    consulted at the time of donation, and this digital consent serves as my formal declaration.
                  </span>
                </label>
              </div>

              <div className="flex justify-end pt-4">
                <Button 
                  type="submit" 
                  size="lg" 
                  loading={isRegistering}
                  disabled={!bloodGroup || selectedOrgans.length === 0 || !hasConsent}
                >
                  Confirm Organ Donation Pledge
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
