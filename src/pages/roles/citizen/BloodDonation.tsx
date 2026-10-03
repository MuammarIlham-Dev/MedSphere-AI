import React, { useState } from 'react';
import { useDonorProfile, useRegisterDonor, useBloodRequests, useLogDonation } from '@/hooks/queries/useBloodQueries';
import { useAuthStore } from '@/stores/authStore';
import { Button } from '@/components/ui/Button';
import { BloodGroup } from '@/types';
import { Droplet, Activity, AlertCircle, Plus } from 'lucide-react';
import { CreateRequestModal } from '@/components/blood/CreateRequestModal';

export default function BloodDonation() {
  const user = useAuthStore(s => s.profile);
  const { data: profile, isLoading } = useDonorProfile();
  const { mutate: register, isPending: isRegistering } = useRegisterDonor();
  const { mutate: logDonation, isPending: isLogging } = useLogDonation();
  const { data: requests, isLoading: isRequestsLoading } = useBloodRequests('urgent');

  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>(profile?.blood_group || '');
  const [isAvailable, setIsAvailable] = useState(profile?.is_available ?? true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  if (isLoading) return <div className="p-8 text-center text-slate-400">Loading donor profile...</div>;

  const handleRegister = () => {
    if (!bloodGroup) return;
    register({ blood_group: bloodGroup as BloodGroup, is_available: isAvailable, privacy_settings: { showPhone: false } });
  };

  // Timer logic
  const lastDonation = profile?.last_donation_date ? new Date(profile.last_donation_date) : null;
  
  let isEligible = true;
  let daysUntilEligible = 0;
  let nextEligibleDate = new Date();
  
  if (lastDonation) {
    nextEligibleDate = new Date(lastDonation);
    nextEligibleDate.setMonth(nextEligibleDate.getMonth() + 4);
    isEligible = nextEligibleDate <= new Date();
    if (!isEligible) {
      daysUntilEligible = Math.ceil((nextEligibleDate.getTime() - new Date().getTime()) / (1000 * 3600 * 24));
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <Droplet className="w-8 h-8 text-rose-500" />
            Blood Donation Network
          </h1>
          <p className="text-slate-400 mt-2">Manage your donor status and help save lives.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Donor Status & Timer */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <h2 className="text-xl font-semibold text-slate-100 mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-400" />
            Your Eligibility
          </h2>
          
          <div className="flex flex-col items-center justify-center p-6 bg-slate-900/50 rounded-lg border border-slate-700 mb-6">
            <div className={`text-4xl font-bold ${isEligible ? 'text-emerald-400' : 'text-amber-400'} mb-2`}>
              {isEligible ? 'Eligible Now' : `${daysUntilEligible} Days`}
            </div>
            <div className="text-slate-400 text-sm">
              {isEligible ? 'You are ready to donate blood.' : `Until you are eligible to donate again (Wait 4 months).`}
            </div>
            {lastDonation && (
              <div className="text-xs text-slate-500 mt-2">
                Last donation was {lastDonation.toLocaleDateString()}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Your Blood Group</label>
              <select
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200"
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}
              >
                <option value="">Select Blood Group</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>
            
            <div className="flex items-center gap-3">
              <input 
                type="checkbox" 
                id="available" 
                checked={isAvailable}
                onChange={(e) => setIsAvailable(e.target.checked)}
                className="w-4 h-4 rounded border-slate-700 bg-slate-900 text-rose-500 focus:ring-rose-500" 
              />
              <label htmlFor="available" className="text-slate-300">I am available for emergency donations</label>
            </div>

            <Button onClick={handleRegister} loading={isRegistering} className="w-full" disabled={!bloodGroup}>
              {profile ? 'Update Donor Profile' : 'Register as Donor'}
            </Button>
            
            {profile && isEligible && (
              <Button variant="secondary" onClick={() => logDonation({ donorId: profile.id })} loading={isLogging} className="w-full">
                I Just Donated Blood
              </Button>
            )}
          </div>
        </div>

        {/* Urgent Requests Feed */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500" />
              Urgent Local Requests
            </h2>
            <Button size="sm" variant="secondary" onClick={() => setShowCreateModal(true)}>
              <Plus className="w-4 h-4 mr-1" /> Request
            </Button>
          </div>

          {isRequestsLoading ? (
            <div className="text-slate-400 text-center py-4">Loading requests...</div>
          ) : requests?.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <div className="bg-slate-900/50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                <Droplet className="w-8 h-8 text-slate-600" />
              </div>
              No urgent blood requests in your area right now.
            </div>
          ) : (
            <div className="space-y-4">
              {requests?.map(req => (
                <div key={req.id} className="bg-slate-900/50 border border-slate-700 p-4 rounded-lg">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-medium text-slate-200">{req.patient_name}</h3>
                      <p className="text-xs text-slate-400">Hospital: {req.hospital_id || 'Unknown'} • Needed by {req.needed_by ? new Date(req.needed_by).toLocaleDateString() : 'ASAP'}</p>
                    </div>
                    <span className="px-2 py-1 bg-rose-500/10 text-rose-400 text-xs font-semibold rounded border border-rose-500/20">
                      {req.blood_group}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-sm text-slate-300">{req.units} Unit(s)</span>
                    <Button variant="primary" disabled={!isEligible || req.blood_group !== profile?.blood_group}>
                      I Can Help
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showCreateModal && <CreateRequestModal onClose={() => setShowCreateModal(false)} />}
    </div>
  );
}
