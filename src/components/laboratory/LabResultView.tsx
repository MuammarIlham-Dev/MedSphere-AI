import type { StructuredLabResult } from '@/types/laboratory';

interface Props {
  result: StructuredLabResult;
}

export function LabResultView({ result }: Props) {
  const value = result.result_type === 'panel'
    ? 'Panel'
    : result.value === null || result.value === '' ? 'Not specified' : String(result.value);

  const reference = result.reference_range.text
    || [result.reference_range.low, result.reference_range.high].filter((x) => x !== null).join(' – ')
    || 'Not specified';

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface-muted/50 p-3 text-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-xs text-slate-500">Result</p><p className="font-medium">{value}{result.unit ? ' ' + result.unit : ''}</p></div>
        <div><p className="text-xs text-slate-500">Reference range</p><p className="font-medium">{reference}</p></div>
        <div><p className="text-xs text-slate-500">Flag</p><p className="font-medium capitalize">{result.abnormal_flag?.replaceAll('_', ' ') || 'Not specified'}</p></div>
        <div><p className="text-xs text-slate-500">Specimen / method</p><p className="font-medium">{[result.specimen, result.method].filter(Boolean).join(' · ') || 'Not specified'}</p></div>
      </div>

      {result.result_type === 'panel' && result.analytes.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="min-w-full text-left text-xs">
            <thead><tr className="border-b border-border"><th className="px-3 py-2">Analyte</th><th className="px-3 py-2">Value</th><th className="px-3 py-2">Unit</th><th className="px-3 py-2">Flag</th></tr></thead>
            <tbody>
              {result.analytes.map((analyte, index) => (
                <tr key={analyte.name + ':' + index} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium">{analyte.name}</td>
                  <td className="px-3 py-2">{analyte.value === null ? '—' : String(analyte.value)}</td>
                  <td className="px-3 py-2">{analyte.unit || '—'}</td>
                  <td className="px-3 py-2 capitalize">{analyte.abnormal_flag?.replaceAll('_', ' ') || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.comment && <p className="text-xs text-slate-600 dark:text-slate-300"><span className="font-medium">Comment:</span> {result.comment}</p>}
    </div>
  );
}

export default LabResultView;
