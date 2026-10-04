import { supabase } from'@/lib/supabase';
import { ApiError } from'@/lib/api';

export interface ResearchStudy {
 id: string;
 researcher_id: string;
 title: string;
 purpose: string;
 status:'pending' |'approved' |'rejected';
 approved_by?: string;
 approved_at?: string;
 scope_region?: string | null;
 created_at: string;
}

export interface CohortStat {
 region_id: string;
 diagnosis: string;
 patient_count: number;
}

export const researchService = {
  async getMyStudies(): Promise<ResearchStudy[]> {
    const res = await supabase
      .from('research_studies')
      .select('*')
      .order('created_at', { ascending: false });

    if (res.error) throw new ApiError('FETCH_STUDIES_FAILED', res.error.message);
    return res.data as ResearchStudy[];
  },

  async submitStudy(title: string, purpose: string): Promise<ResearchStudy> {
    const normalizedTitle = title.trim();
    const normalizedPurpose = purpose.trim();
    if (normalizedTitle.length < 3 || normalizedTitle.length > 200) {
      throw new ApiError('INVALID_STUDY_TITLE', 'Study title must be between 3 and 200 characters.');
    }
    if (normalizedPurpose.length < 10 || normalizedPurpose.length > 4000) {
      throw new ApiError('INVALID_STUDY_PURPOSE', 'Study purpose must be between 10 and 4000 characters.');
    }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError('UNAUTHORIZED','Not logged in');

    const res = await supabase
      .from('research_studies')
      .insert({ researcher_id: user.id, title: normalizedTitle, purpose: normalizedPurpose })
      .select()
      .single();

    if (res.error) throw new ApiError('SUBMIT_STUDY_FAILED', res.error.message);
    return res.data as ResearchStudy;
  },

  async getCohortStats(studyId: string, region?: string, diagnosis?: string): Promise<CohortStat[]> {
    if (!studyId.trim()) throw new ApiError('INVALID_STUDY', 'Study selection is required.');
    if ((region?.trim().length ?? 0) > 120) throw new ApiError('INVALID_REGION', 'Region filter is too long.');
    if ((diagnosis?.trim().length ?? 0) > 120) throw new ApiError('INVALID_DIAGNOSIS', 'Diagnosis filter is too long.');
    const res = await supabase.rpc('get_anonymized_cohort_stats', {
      p_study_id: studyId,
      p_region: region || null,
      p_diagnosis: diagnosis || null
    });

    if (res.error) throw new ApiError('COHORT_QUERY_FAILED', res.error.message);
    return res.data as CohortStat[];
  }
};
