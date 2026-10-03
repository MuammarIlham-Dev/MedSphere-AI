import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { IoDocumentTextOutline, IoMedkitOutline, IoCalendarOutline, IoFlaskOutline } from 'react-icons/io5';
import { useUiStore } from '@/stores/uiStore';
import { AiTimelineSummarizer } from '@/components/intelligence/AiTimelineSummarizer';
import { ehrService } from '@/services/ehr.service';
import { formatDateTime } from '@/lib/utils';

interface PatientEhrModalProps {
  open: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
  appointmentId: string;
}

export function PatientEhrModal({ open, onClose, patientId, patientName, appointmentId }: PatientEhrModalProps) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'record' | 'labs' | 'prescriptions'>('timeline');
  const [title, setTitle] = useState('Consultation note');
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  const [prescriptionItems, setPrescriptionItems] = useState<any[]>([]);
  const [medQuery, setMedQuery] = useState('');
  const [selectedMed, setSelectedMed] = useState<{ id: string; name: string } | null>(null);
  const [dosage, setDosage] = useState('');
  const [frequency, setFrequency] = useState('');
  const [duration, setDuration] = useState('7');
  const [instructions, setInstructions] = useState('');
  
  const toast = useUiStore((s) => s.toast);
  const queryClient = useQueryClient();

  const recordsQuery = useQuery({
    queryKey: ['ehr', patientId],
    queryFn: () => ehrService.records(patientId),
    enabled: open && !!patientId,
  });
  const labsQuery = useQuery({
    queryKey: ['ehr-labs', patientId],
    queryFn: () => ehrService.labReports(patientId),
    enabled: open && !!patientId && activeTab === 'labs',
  });
  const rxQuery = useQuery({
    queryKey: ['ehr-rx', patientId],
    queryFn: () => ehrService.prescriptions(patientId),
    enabled: open && !!patientId && activeTab === 'prescriptions',
  });
  
  const searchMedsQuery = useQuery({
    queryKey: ['medicines', medQuery],
    queryFn: () => ehrService.searchMedicines(medQuery),
    enabled: medQuery.length > 2,
  });
  
  const save = useMutation({
    mutationFn: ehrService.recordConsultation,
    onSuccess: () => {
      toast('success', `Consultation saved to ${patientName}'s health record`);
      setDiagnosis('');
      setNotes('');
      setPrescriptionNotes('');
      setPrescriptionItems([]);
      void queryClient.invalidateQueries({ queryKey: ['ehr', patientId] });
    },
    onError: (error) => { toast('error', error instanceof Error ? error.message : 'Could not save consultation'); },
  });

  const records = recordsQuery.data ?? [];
  const timelineRecords = records.map((record) => ({
    date: record.created_at,
    type: record.title,
    notes: [record.diagnosis, record.notes].filter(Boolean).join(' — '),
  }));

  const handleSave = () => {
    if (!title.trim()) { toast('error', 'A record title is required'); return; }
    if (!notes.trim() && !diagnosis.trim() && !prescriptionNotes.trim() && prescriptionItems.length === 0) {
      toast('error', 'Add clinical notes, a diagnosis, or prescription instructions'); return;
    }
    save.mutate({ 
      appointmentId, 
      title, 
      diagnosis, 
      notes, 
      prescriptionNotes, 
      prescriptionItems 
    });
  };

  const handleAddItem = () => {
    if (!selectedMed || !dosage || !frequency || !duration) return;
    setPrescriptionItems([...prescriptionItems, {
      medicine_id: selectedMed.id,
      medicine_name: selectedMed.name,
      dosage,
      frequency,
      duration_days: parseInt(duration, 10) || 7,
      instructions
    }]);
    setSelectedMed(null);
    setMedQuery('');
    setDosage('');
    setFrequency('');
    setDuration('7');
    setInstructions('');
  };

  const handleRemoveItem = (index: number) => {
    setPrescriptionItems(prescriptionItems.filter((_, i) => i !== index));
  };

  return (
    <Modal open={open} onClose={onClose} title={`Patient EHR: ${patientName}`} wide>
      <div className="flex flex-wrap gap-4 border-b border-border pb-4">
        <Button variant={activeTab === 'timeline' ? 'primary' : 'secondary'} size="sm" onClick={() => { setActiveTab('timeline'); }}>
          <IoCalendarOutline className="mr-2" /> Timeline & AI Summary
        </Button>
        <Button variant={activeTab === 'record' ? 'primary' : 'secondary'} size="sm" onClick={() => { setActiveTab('record'); }}>
          <IoMedkitOutline className="mr-2" /> Record Consultation
        </Button>
        <Button variant={activeTab === 'labs' ? 'primary' : 'secondary'} size="sm" onClick={() => { setActiveTab('labs'); }}>
          <IoFlaskOutline className="mr-2" /> Lab Reports
        </Button>
        <Button variant={activeTab === 'prescriptions' ? 'primary' : 'secondary'} size="sm" onClick={() => { setActiveTab('prescriptions'); }}>
          <IoDocumentTextOutline className="mr-2" /> Prescriptions
        </Button>
      </div>

      <div className="mt-4 min-h-[300px]">
        {activeTab === 'timeline' && (
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <h3 className="mb-3 font-semibold">Medical History</h3>
              {recordsQuery.isLoading && <p className="text-sm text-slate-400">Loading medical history…</p>}
              {recordsQuery.error && <p className="text-sm text-danger-600">Medical history could not be loaded.</p>}
              {!recordsQuery.isLoading && records.length === 0 && <p className="text-sm text-slate-400">No medical records are available.</p>}
              <ul className="space-y-4">
                {records.map((record) => (
                  <li key={record.id} className="flex gap-3 text-sm">
                    <div className="mt-0.5 text-slate-400"><IoDocumentTextOutline /></div>
                    <div>
                      <p className="font-medium">{record.title} <span className="ml-2 text-xs font-normal text-slate-400">{formatDateTime(record.created_at)}</span></p>
                      {record.diagnosis && <p className="mt-1 font-medium text-slate-600 dark:text-slate-300">Diagnosis: {record.diagnosis}</p>}
                      {record.notes && <p className="mt-1 text-slate-500 dark:text-slate-400">{record.notes}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <AiTimelineSummarizer records={timelineRecords} />
          </div>
        )}

        {activeTab === 'record' && (
          <div className="space-y-4">
            <h3 className="font-semibold">Consultation record</h3>
            <Input label="Record title" value={title} onChange={(event) => { setTitle(event.target.value); }} />
            <Input label="Diagnosis" value={diagnosis} onChange={(event) => { setDiagnosis(event.target.value); }} placeholder="Clinical diagnosis, if established" />
            <label className="block text-sm font-medium">
              Clinical notes
              <textarea className="mt-1 h-28 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900"
                value={notes} onChange={(event) => { setNotes(event.target.value); }} placeholder="Symptoms, observations, vitals, and follow-up plan" />
            </label>
            <label className="block text-sm font-medium">
              Structured Prescription Items
            </label>
            <div className="rounded-xl border border-border p-4 dark:border-white/10 space-y-4">
              {prescriptionItems.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm border-b pb-2 dark:border-white/5">
                  <div>
                    <span className="font-medium">{item.medicine_name}</span> - {item.dosage} ({item.frequency})
                    <p className="text-xs text-slate-500">Duration: {item.duration_days} days. {item.instructions}</p>
                  </div>
                  <Button variant="danger" size="sm" onClick={() => handleRemoveItem(idx)}>Remove</Button>
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <Input label="Medicine Search" placeholder="Type to search..." value={medQuery} onChange={e => setMedQuery(e.target.value)} />
                  {medQuery.length > 2 && !selectedMed && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg dark:bg-slate-800 dark:border-slate-700 max-h-40 overflow-y-auto">
                      {searchMedsQuery.isLoading ? <div className="p-2 text-xs text-slate-500">Searching...</div> : (
                        searchMedsQuery.data?.length === 0 ? <div className="p-2 text-xs text-slate-500">No medicines found.</div> :
                        searchMedsQuery.data?.map(m => (
                          <div key={m.id} className="p-2 text-sm hover:bg-slate-100 dark:hover:bg-slate-700 cursor-pointer" onClick={() => { setSelectedMed(m); setMedQuery(m.name); }}>
                            {m.name}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <Input label="Dosage" placeholder="e.g., 500mg" value={dosage} onChange={e => setDosage(e.target.value)} />
                <Input label="Frequency" placeholder="e.g., 1x daily" value={frequency} onChange={e => setFrequency(e.target.value)} />
                <Input label="Duration (days)" type="number" value={duration} onChange={e => setDuration(e.target.value)} />
                <Input label="Instructions" placeholder="e.g., After meals" value={instructions} onChange={e => setInstructions(e.target.value)} />
              </div>
              <Button size="sm" variant="secondary" onClick={handleAddItem} disabled={!selectedMed || !dosage || !frequency}>Add Medicine</Button>
            </div>
            <label className="block text-sm font-medium">
              Prescription notes (optional)
              <textarea className="mt-1 h-20 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900"
                value={prescriptionNotes} onChange={(event) => { setPrescriptionNotes(event.target.value); }} placeholder="Additional prescription notes" />
            </label>
            <div className="flex justify-end">
              <Button onClick={handleSave} loading={save.isPending}>Save consultation</Button>
            </div>
          </div>
        )}

        {activeTab === 'labs' && (
          <div className="space-y-3">
            {labsQuery.isLoading && <p className="py-10 text-center text-sm text-slate-400">Loading lab reports…</p>}
            {labsQuery.error && <p className="py-10 text-center text-sm text-danger-600">Lab reports could not be loaded.</p>}
            {!labsQuery.isLoading && (labsQuery.data ?? []).length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <IoFlaskOutline className="mb-2 h-10 w-10 opacity-50" />
                <p>No lab reports are available for this patient.</p>
              </div>
            )}
            {(labsQuery.data ?? []).map((report) => (
              <div key={report.id} className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">{report.test_name ?? 'Laboratory report'}</p>
                  <Badge tone={report.status === 'verified' ? 'success' : 'neutral'}>{report.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-400">{report.report_code} · {formatDateTime(report.created_at)}</p>
                <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-slate-600 dark:text-slate-300">{JSON.stringify(report.result_json, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'prescriptions' && (
          <div className="space-y-3">
            {rxQuery.isLoading && <p className="py-10 text-center text-sm text-slate-400">Loading prescriptions…</p>}
            {rxQuery.error && <p className="py-10 text-center text-sm text-danger-600">Prescriptions could not be loaded.</p>}
            {!rxQuery.isLoading && (rxQuery.data ?? []).length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                <IoDocumentTextOutline className="mb-2 h-10 w-10 opacity-50" />
                <p>No prescriptions are available for this patient.</p>
              </div>
            )}
            {(rxQuery.data ?? []).map((rx) => (
              <div key={rx.id} className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
                <p className="font-medium">Prescription · {formatDateTime(rx.created_at)}</p>
                {rx.notes && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{rx.notes}</p>}
                {rx.prescription_items?.length > 0 && (
                  <ul className="mt-3 list-inside list-disc text-sm text-slate-500">
                    {rx.prescription_items.map((item: any) => (
                      <li key={item.id}>{item.medicines?.name || 'Unknown medicine'} - {item.dosage} ({item.frequency}, {item.duration_days} days). {item.instructions}</li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
