export type LabResultType = 'numeric' | 'qualitative' | 'text' | 'panel';

export type LabAbnormalFlag =
  | 'normal' | 'low' | 'high' | 'critical_low' | 'critical_high'
  | 'positive' | 'negative' | 'abnormal' | 'indeterminate';

export interface LabReferenceRange {
  low: number | null;
  high: number | null;
  text: string | null;
}

export interface LabAnalyteResult {
  name: string;
  value: string | number | null;
  unit?: string | null;
  reference_range?: Partial<LabReferenceRange> | null;
  abnormal_flag?: LabAbnormalFlag | null;
}

export interface StructuredLabResult {
  schema_version: 1;
  result_type: LabResultType;
  value: string | number | null;
  unit: string | null;
  reference_range: LabReferenceRange;
  abnormal_flag: LabAbnormalFlag | null;
  specimen: string | null;
  method: string | null;
  comment: string | null;
  analytes: LabAnalyteResult[];
}

export const createEmptyLabResult = (): StructuredLabResult => ({
  schema_version: 1,
  result_type: 'numeric',
  value: null,
  unit: null,
  reference_range: { low: null, high: null, text: null },
  abnormal_flag: null,
  specimen: null,
  method: null,
  comment: null,
  analytes: [],
});

export function parseStructuredLabResult(value: unknown): StructuredLabResult {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return createEmptyLabResult();
  const raw = value as Record<string, unknown>;
  if (raw.schema_version !== 1) {
    const legacy = raw.result;
    return {
      ...createEmptyLabResult(),
      result_type: 'text',
      value: typeof legacy === 'string' || typeof legacy === 'number' ? legacy : JSON.stringify(legacy ?? raw),
    };
  }
  const resultType: LabResultType =
    raw.result_type === 'qualitative' || raw.result_type === 'text' || raw.result_type === 'panel'
      ? raw.result_type
      : 'numeric';

  const rangeRaw = raw.reference_range && typeof raw.reference_range === 'object' && !Array.isArray(raw.reference_range)
    ? raw.reference_range as Record<string, unknown>
    : {};

  const flag = typeof raw.abnormal_flag === 'string'
    ? raw.abnormal_flag as LabAbnormalFlag
    : null;

  const analytes = Array.isArray(raw.analytes)
    ? raw.analytes.filter((item): item is LabAnalyteResult => !!item && typeof item === 'object' && !Array.isArray(item))
        .map((item) => item as LabAnalyteResult)
    : [];

  return {
    schema_version: 1,
    result_type: resultType,
    value: typeof raw.value === 'number' || typeof raw.value === 'string' ? raw.value : null,
    unit: typeof raw.unit === 'string' ? raw.unit : null,
    reference_range: {
      low: typeof rangeRaw.low === 'number' ? rangeRaw.low : null,
      high: typeof rangeRaw.high === 'number' ? rangeRaw.high : null,
      text: typeof rangeRaw.text === 'string' ? rangeRaw.text : null,
    },
    abnormal_flag: flag,
    specimen: typeof raw.specimen === 'string' ? raw.specimen : null,
    method: typeof raw.method === 'string' ? raw.method : null,
    comment: typeof raw.comment === 'string' ? raw.comment : null,
    analytes,
  };
}
