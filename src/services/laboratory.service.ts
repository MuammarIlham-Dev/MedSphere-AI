import { supabase } from '@/lib/supabase';
import { ApiError, unwrap } from '@/lib/api';

export interface LabWorklistItem {
  id: string;
  test_id: string;
  test_name: string;
  test_code: string;
  sample_status: string;
  collected_at: string | null;
  report_id: string | null;
  report_status: string | null;
  report_code: string | null;
  report_file_id: string | null;
}

export interface LabWorklistOrder {
  id: string;
  appointment_id: string | null;
  patient_id: string;
  patient_name: string;
  doctor_id: string | null;
  doctor_name: string | null;
  hospital_name: string | null;
  priority: string;
  status: string;
  booked_at: string;
  accepted_at: string | null;
  items: LabWorklistItem[];
}

interface LabWorklistRow {
  order_id: string;
  appointment_id: string | null;
  patient_id: string;
  patient_name: string;
  doctor_id: string | null;
  doctor_name: string | null;
  hospital_name: string | null;
  priority: string;
  order_status: string;
  booked_at: string;
  accepted_at: string | null;
  test_id: string;
  test_code: string;
  test_name: string;
  sample_status: string;
  collected_at: string | null;
  report_id: string | null;
  report_status: string | null;
  report_code: string | null;
  report_file_id: string | null;
}

const fileExt = (mime: string) => mime === 'application/pdf' ? 'pdf' : mime === 'image/png' ? 'png' : mime === 'image/jpeg' ? 'jpg' : null;

const uploadReportDocument = async (file: File) => {
  const user = (await supabase.auth.getUser()).data.user;
  if (!user) throw new ApiError('AUTH', 'Not signed in');
  const ext = fileExt(file.type);
  if (!ext) throw new ApiError('VALIDATION', 'Report document must be a PDF, JPG, or PNG');
  if (file.size > 20 * 1024 * 1024) throw new ApiError('VALIDATION', 'Report document must be 20 MB or smaller');
  const path = user.id + '/lab-reports/' + crypto.randomUUID() + '.' + ext;
  const upload = await supabase.storage.from('reports').upload(path, file, { contentType:file.type, cacheControl:'3600', upsert:false });
  if (upload.error) throw upload.error;
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  const sha256 = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
  try {
    const row = await unwrap<{id:string}>(supabase.from('files').insert({ owner_id:user.id, bucket:'reports', path, mime:file.type, size_bytes:file.size, sha256, purpose:'lab_report' }).select('id').single());
    return {fileId:row.id,path};
  } catch(error) {
    await supabase.storage.from('reports').remove([path]);
    throw error;
  }
};

const removeReportDocument = async (fileId:string,path:string) => {
  await supabase.storage.from('reports').remove([path]);
  await supabase.from('files').delete().eq('id',fileId);
};

export const laboratoryService = {
  worklist: async (labId: string): Promise<LabWorklistOrder[]> => {
    const rows = await unwrap<LabWorklistRow[]>(
      supabase.rpc('get_laboratory_worklist', { p_lab_id: labId }),
    );

    const grouped = new Map<string, LabWorklistOrder>();
    for (const row of rows) {
      const item: LabWorklistItem = {
        id: row.order_id + ':' + row.test_id,
        test_id: row.test_id,
        test_name: row.test_name,
        test_code: row.test_code,
        sample_status: row.sample_status,
        collected_at: row.collected_at,
        report_id: row.report_id,
        report_status: row.report_status,
        report_code: row.report_code,
        report_file_id: row.report_file_id,
      };
      const existing = grouped.get(row.order_id);
      if (existing) {
        existing.items.push(item);
        continue;
      }
      grouped.set(row.order_id, {
        id: row.order_id,
        appointment_id: row.appointment_id,
        patient_id: row.patient_id,
        patient_name: row.patient_name,
        doctor_id: row.doctor_id,
        doctor_name: row.doctor_name,
        hospital_name: row.hospital_name,
        priority: row.priority,
        status: row.order_status,
        booked_at: row.booked_at,
        accepted_at: row.accepted_at,
        items: [item],
      });
    }
    return Array.from(grouped.values());
  },

  acceptOrder: (orderId: string) =>
    unwrap(supabase.rpc('accept_lab_order', { p_order_id: orderId })),

  advanceSample: (itemId: string) =>
    unwrap(supabase.rpc('advance_lab_sample', { p_item_id: itemId })),

  async createReport(input: { orderId: string; testId: string; result: Record<string, unknown>; file?: File | null }) {
    const report = await unwrap<{ id: string }>(supabase.rpc('create_lab_report', {
      p_order_id: input.orderId,
      p_test_id: input.testId,
      p_result_json: input.result,
      p_file_id: null,
    }));
    if (!input.file) return report;

    let uploaded: { fileId: string; path: string } | null = null;
    try {
      uploaded = await uploadReportDocument(input.file);
      return await unwrap(supabase.rpc('attach_lab_report_document', {
        p_report_id: report.id,
        p_file_id: uploaded.fileId,
      }));
    } catch (error) {
      if (uploaded) {
        const check = await supabase.from('lab_reports').select('file_id').eq('id', report.id).maybeSingle();
        if (check.data?.file_id === null) await removeReportDocument(uploaded.fileId, uploaded.path);
      }
      throw error;
    }
  },

  openReportDocument: async (reportId: string): Promise<string> => {
    const { data, error } = await supabase.functions.invoke<{ signedUrl: string }>('lab-report-document', { body: { reportId } });
    if (error) throw error;
    if (!data?.signedUrl) throw new ApiError('SERVER', 'Could not open laboratory document');
    return data.signedUrl;
  },

  verifyReport: (reportId: string) =>
    unwrap(supabase.rpc('verify_lab_report', { p_report_id: reportId })),

  deliverReport: (reportId: string) =>
    unwrap(supabase.rpc('deliver_lab_report', { p_report_id: reportId })),
};
