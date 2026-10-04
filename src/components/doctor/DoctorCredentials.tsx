import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Select } from '@/components/ui/Input';
import { doctorService } from '@/services/doctor.service';
import type { Doctor, DoctorCredential } from '@/types';
import { formatDateTime } from '@/lib/utils';
import { useUiStore } from '@/stores/uiStore';

const TYPES: Array<{ value: DoctorCredential['credential_type']; label: string }> = [
  { value: 'medical_license', label: 'Medical license' },
  { value: 'degree', label: 'Degree / primary qualification' },
  { value: 'specialty_certificate', label: 'Specialty certificate' },
  { value: 'identity', label: 'Identity document' },
  { value: 'other', label: 'Other professional document' },
];

export function DoctorCredentials({ doctor }: { doctor: Doctor & { verification_due_at?: string | null } }) {
  const qc = useQueryClient();
  const toast = useUiStore((s) => s.toast);
  const [type, setType] = useState<DoctorCredential['credential_type']>('medical_license');
  const [documentNumber, setDocumentNumber] = useState('');
  const [issuedAt, setIssuedAt] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const query = useQuery({
    queryKey: ['doctor-credentials', doctor.id],
    queryFn: doctorService.credentials,
  });

  const submit = useMutation({
    mutationFn: () => {
      if (!file) throw new Error('Select a credential document');
      return doctorService.uploadCredential({
        credentialType: type,
        file,
        documentNumber,
        issuedAt: issuedAt || undefined,
        expiresAt: expiresAt || undefined,
      });
    },
    onSuccess: () => {
      toast('success', 'Credential submitted for review');
      setFile(null); setDocumentNumber(''); setIssuedAt(''); setExpiresAt('');
      void qc.invalidateQueries({ queryKey: ['doctor-credentials', doctor.id] });
      void qc.invalidateQueries({ queryKey: ['my-doctor'] });
    },
    onError: (e) => toast('error', e instanceof Error ? e.message : 'Credential submission failed'),
  });

  const dueSoon = useMemo(() => {
    if (!doctor.verification_due_at) return false;
    return new Date(doctor.verification_due_at).getTime() - Date.now() <= 30 * 86400000;
  }, [doctor.verification_due_at]);

  return (
    <Card className="mt-6">
      <CardHeader
        title="Professional credentials"
        subtitle="Evidence is stored privately and reviewed by authorized administrators."
      />
      <div className="space-y-5 p-6">
        <div className="grid gap-3 rounded-xl border border-border bg-surface-muted p-4 sm:grid-cols-3 dark:bg-surface-dark-muted">
          <div><p className="text-xs text-slate-400">Verification</p><p className="mt-1 font-medium">{doctor.verification}</p></div>
          <div><p className="text-xs text-slate-400">Verified</p><p className="mt-1 font-medium">{doctor.verified_at ? formatDateTime(doctor.verified_at) : 'Not yet verified'}</p></div>
          <div><p className="text-xs text-slate-400">Review due</p><p className="mt-1 font-medium">{doctor.verification_due_at ? formatDateTime(doctor.verification_due_at) : 'After approval'}</p></div>
        </div>
        {dueSoon && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">Verification is due soon. Submit updated professional evidence before the review date.</div>}

        <div className="space-y-2">
          {(query.data ?? []).map((credential) => (
            <div key={credential.id} className="flex flex-col gap-2 rounded-xl border border-border p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{TYPES.find((t) => t.value === credential.credential_type)?.label ?? credential.credential_type}</p>
                <p className="text-xs text-slate-500">{credential.document_number ? 'Document '+credential.document_number+' · ' : ''}Submitted {formatDateTime(credential.created_at)}</p>
                {credential.expires_at && <p className="text-xs text-slate-400">Expires {credential.expires_at}</p>}
                {credential.review_notes && <p className="mt-1 text-xs text-danger-600">{credential.review_notes}</p>}
              </div>
              <Badge tone={credential.status === 'accepted' ? 'success' : credential.status === 'rejected' ? 'danger' : 'warning'}>{credential.status}</Badge>
            </div>
          ))}
          {!query.isLoading && (query.data ?? []).length === 0 && <p className="text-sm text-slate-400">No credential evidence submitted yet.</p>}
        </div>

        <div className="border-t border-border pt-5">
          <p className="mb-3 font-semibold">Submit / replace evidence</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <Select label="Document type" value={type} onChange={(e) => setType(e.target.value as DoctorCredential['credential_type'])}>
              {TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </Select>
            <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">Document file
              <input type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-white/15" />
            </label>
            <label className="space-y-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">Document number
              <input value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-white/15 dark:bg-surface-dark-muted" placeholder={type === 'medical_license' ? doctor.license_no : 'Optional'} />
            </label>
            <input aria-label="Issued date" type="date" value={issuedAt} onChange={(e) => setIssuedAt(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-white/15 dark:bg-surface-dark-muted" />
            <input aria-label="Expiry date" type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-white/15 dark:bg-surface-dark-muted" />
          </div>
          <p className="mt-2 text-xs text-slate-400">PDF/JPG/PNG only · maximum 10 MB. The file is private; only you and authorized administrators can access it.</p>
          <Button className="mt-4" loading={submit.isPending} disabled={!file} onClick={() => submit.mutate()}>Submit credential</Button>
        </div>
      </div>
    </Card>
  );
}
