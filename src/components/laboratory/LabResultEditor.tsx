import { useState } from 'react';
import {
  createEmptyLabResult,
  type LabAbnormalFlag,
  type LabResultType,
  type StructuredLabResult,
} from '@/types/laboratory';

interface Props {
  value: StructuredLabResult;
  onChange: (value: StructuredLabResult) => void;
  readOnly?: boolean;
}

const flags: Array<LabAbnormalFlag | ''> = [
  '', 'normal', 'low', 'high', 'critical_low', 'critical_high',
  'positive', 'negative', 'abnormal', 'indeterminate',
];

const inputClass = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500 dark:border-white/10 dark:bg-surface-dark-muted';

const safeType = (value: string): LabResultType =>
  value === 'qualitative' || value === 'text' || value === 'panel' ? value : 'numeric';

export function LabResultEditor({ value, onChange, readOnly = false }: Props) {
  const [analyteJson, setAnalyteJson] = useState(() => JSON.stringify(value.analytes, null, 2));
  const [analyteError, setAnalyteError] = useState<string | null>(null);

  const setField = <K extends keyof StructuredLabResult>(key: K, next: StructuredLabResult[K]) =>
    onChange({ ...value, [key]: next });

  const updateRange = (key: 'low' | 'high' | 'text', raw: string) => {
    const next =
      key === 'text'
        ? raw || null
        : raw.trim() === '' ? null : Number(raw);
    onChange({ ...value, reference_range: { ...value.reference_range, [key]: next } });
  };

  const updateAnalytes = (raw: string) => {
    setAnalyteJson(raw);
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Provide a non-empty JSON array');
      if (parsed.some((item) => !item || typeof item !== 'object' || Array.isArray(item) || typeof (item as Record<string, unknown>).name !== 'string')) {
        throw new Error('Each analyte must be an object with a name');
      }
      setAnalyteError(null);
      onChange({ ...value, analytes: parsed as StructuredLabResult['analytes'] });
    } catch (error) {
      setAnalyteError(error instanceof Error ? error.message : 'Invalid analyte JSON');
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Result type
          <select
            disabled={readOnly}
            value={value.result_type}
            onChange={(e) => {
              const next = safeType(e.target.value);
              const nextValue = next === 'panel'
                ? null
                : next === 'numeric'
                  ? (typeof value.value === 'number' ? value.value : value.value === null || value.value === '' || Number.isNaN(Number(value.value)) ? null : Number(value.value))
                  : (value.value === null ? null : String(value.value));
              onChange({ ...value, result_type: next, value: nextValue });
              if (next !== 'panel') setAnalyteError(null);
            }}
            className={inputClass + ' mt-1'}
          >
            <option value="numeric">Numeric</option>
            <option value="qualitative">Qualitative</option>
            <option value="text">Text / free result</option>
            <option value="panel">Panel / multiple analytes</option>
          </select>
        </label>

        {value.result_type !== 'panel' ? (
          <label className="text-sm font-medium">
            Result value
            <input
              disabled={readOnly}
              type={value.result_type === 'numeric' ? 'number' : 'text'}
              value={value.value ?? ''}
              onChange={(e) => setField('value', value.result_type === 'numeric' ? (e.target.value === '' ? null : Number(e.target.value)) : e.target.value)}
              className={inputClass + ' mt-1'}
            />
          </label>
        ) : (
          <div className="rounded-xl bg-surface-muted p-3 text-xs text-slate-500">
            Panel results are recorded as structured analytes below.
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm font-medium">
          Unit
          <input disabled={readOnly} value={value.unit ?? ''} onChange={(e) => setField('unit', e.target.value || null)} placeholder="mg/dL, mmol/L, %" className={inputClass + ' mt-1'} />
        </label>
        <label className="text-sm font-medium">
          Reference low
          <input disabled={readOnly} type="number" value={value.reference_range.low ?? ''} onChange={(e) => updateRange('low', e.target.value)} className={inputClass + ' mt-1'} />
        </label>
        <label className="text-sm font-medium">
          Reference high
          <input disabled={readOnly} type="number" value={value.reference_range.high ?? ''} onChange={(e) => updateRange('high', e.target.value)} className={inputClass + ' mt-1'} />
        </label>
        <label className="text-sm font-medium">
          Abnormal flag
          <select disabled={readOnly} value={value.abnormal_flag ?? ''} onChange={(e) => setField('abnormal_flag', e.target.value ? e.target.value as LabAbnormalFlag : null)} className={inputClass + ' mt-1'}>
            {flags.map((flag) => <option key={flag} value={flag}>{flag ? flag.replaceAll('_', ' ') : 'Not specified'}</option>)}
          </select>
        </label>
      </div>

      <label className="text-sm font-medium">
        Reference range / interpretation text
        <input disabled={readOnly} value={value.reference_range.text ?? ''} onChange={(e) => updateRange('text', e.target.value)} placeholder="e.g. Adult: 70–100 mg/dL" className={inputClass + ' mt-1'} />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-medium">
          Specimen
          <input disabled={readOnly} value={value.specimen ?? ''} onChange={(e) => setField('specimen', e.target.value || null)} placeholder="Serum, EDTA blood…" className={inputClass + ' mt-1'} />
        </label>
        <label className="text-sm font-medium">
          Method
          <input disabled={readOnly} value={value.method ?? ''} onChange={(e) => setField('method', e.target.value || null)} placeholder="Analyzer / assay method" className={inputClass + ' mt-1'} />
        </label>
      </div>

      <label className="text-sm font-medium">
        Comment
        <textarea disabled={readOnly} value={value.comment ?? ''} onChange={(e) => setField('comment', e.target.value || null)} className={inputClass + ' mt-1 min-h-20'} />
      </label>

      {value.result_type === 'panel' && (
        <div>
          <label className="text-sm font-medium">
            Analytes JSON
            <textarea
              disabled={readOnly}
              value={analyteJson}
              onChange={(e) => updateAnalytes(e.target.value)}
              className={inputClass + ' mt-1 min-h-36 font-mono text-xs'}
              spellCheck={false}
            />
          </label>
          {analyteError && <p className="mt-1 text-xs text-danger-600">{analyteError}</p>}
          <p className="mt-1 text-xs text-slate-500">Each item needs at least a <code>name</code> and <code>value</code>. Optional unit, reference_range and abnormal_flag are supported.</p>
        </div>
      )}
    </div>
  );
}

export function createDefaultLabResult(): StructuredLabResult {
  return createEmptyLabResult();
}

export default LabResultEditor;
