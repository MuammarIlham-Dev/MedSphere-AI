import React, { useState } from 'react';
import { useCreateBloodRequest } from '@/hooks/queries/useBloodQueries';
import { Button } from '@/components/ui/Button';
import { BloodGroup, Urgency } from '@/types';
import { X } from 'lucide-react';

interface Props {
  onClose: () => void;
}

export function CreateRequestModal({ onClose }: Props) {
  const { mutate: createRequest, isPending } = useCreateBloodRequest();
  const [formData, setFormData] = useState({
    patient_name: '',
    blood_group: '' as BloodGroup | '',
    units: 1,
    urgency: 'normal' as Urgency,
    needed_by: '',
    notes: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.blood_group) return;
    createRequest(
      { ...formData, blood_group: formData.blood_group as BloodGroup },
      { onSuccess: () => onClose() }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-slate-800 rounded-xl max-w-md w-full border border-slate-700 shadow-xl overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-slate-700 bg-slate-900/50">
          <h2 className="text-lg font-semibold text-slate-100">Request Blood</h2>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-700 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Patient Name</label>
            <input 
              required
              type="text" 
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200" 
              value={formData.patient_name}
              onChange={(e) => setFormData(p => ({ ...p, patient_name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Blood Group</label>
              <select
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200"
                value={formData.blood_group}
                onChange={(e) => setFormData(p => ({ ...p, blood_group: e.target.value as BloodGroup }))}
              >
                <option value="">Select</option>
                {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(bg => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Units Needed</label>
              <input 
                required
                type="number" 
                min="1"
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200" 
                value={formData.units}
                onChange={(e) => setFormData(p => ({ ...p, units: parseInt(e.target.value) }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Urgency</label>
              <select
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200"
                value={formData.urgency}
                onChange={(e) => setFormData(p => ({ ...p, urgency: e.target.value as Urgency }))}
              >
                <option value="normal">Normal</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">Needed By</label>
              <input 
                type="date" 
                className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200" 
                value={formData.needed_by}
                onChange={(e) => setFormData(p => ({ ...p, needed_by: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">Notes (Optional)</label>
            <textarea 
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-slate-200 resize-none" 
              rows={2}
              value={formData.notes}
              onChange={(e) => setFormData(p => ({ ...p, notes: e.target.value }))}
            ></textarea>
          </div>

          <div className="pt-4 flex justify-end gap-3 border-t border-slate-700">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={isPending}>Submit Request</Button>
          </div>
        </form>
      </div>
    </div>
  );
}
