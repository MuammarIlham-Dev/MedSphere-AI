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
  const [activeTab, setActiveTab] = useState<'timeline' | 'prescription' | 'labs'>('timeline');
  const [title, setTitle] = useState('Consultation note');
  const [diagnosis, setDiagnosis] = useState('');
  const [notes, setNotes] = useState('');
  const [prescription, setPrescription] = useState('');
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
  const save = useMutation({
    mutationFn: ehrService.recordConsultation,
    onSuccess: () => {
      toast('success', `Consultation saved to ${patientName}'s health record`);
      setDiagnosis('');
      setNotes('');
      setPrescription('');
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
    if (!notes.trim() && !diagnosis.trim() && !prescription.trim()) {
      toast('error', 'Add clinical notes, a diagnosis, or prescription instructions'); return;
    }
    save.mutate({ appointmentId, title, diagnosis, notes, prescriptionNotes: prescription });
  };

  return (
    <Modal open={open} onClose={onClose} title={`Patient EHR: ${patientName}`} wide>
      <div className="flex flex-wrap gap-4 border-b border-border pb-4">
        <Button variant={activeTab === 'timeline' ? 'primary' : 'secondary'} size="sm" onClick={() => { setActiveTab('timeline'); }}>
          <IoCalendarOutline className="mr-2" /> Timeline & AI Summary
        </Button>
        <Button variant={activeTab === 'prescription' ? 'primary' : 'secondary'} size="sm" onClick={() => { setActiveTab('prescription'); }}>
          <IoMedkitOutline className="mr-2" /> Record Consultation
        </Button>
        <Button variant={activeTab === 'labs' ? 'primary' : 'secondary'} size="sm" onClick={() => { setActiveTab('labs'); }}>
          <IoFlaskOutline className="mr-2" /> Lab Reports
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

        {activeTab === 'prescription' && (
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
              Prescription instructions (optional)
              <textarea className="mt-1 h-32 w-full rounded-xl border border-border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:bg-slate-900"
                value={prescription} onChange={(event) => { setPrescription(event.target.value); }} placeholder="Medicine, dosage, frequency, duration, and instructions" />
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
      </div>
    </Modal>
  );
}
