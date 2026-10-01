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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new ApiError('UNAUTHORIZED','Not logged in');

    const res = await supabase
      .from('research_studies')
      .insert({ researcher_id: user.id, title, purpose })
      .select()
      .single();

    if (res.error) throw new ApiError('SUBMIT_STUDY_FAILED', res.error.message);
    return res.data as ResearchStudy;
  },

  async getCohortStats(studyId: string, region?: string, diagnosis?: string): Promise<CohortStat[]> {
    const res = await supabase.rpc('get_anonymized_cohort_stats', {
      p_study_id: studyId,
      p_region: region || null,
      p_diagnosis: diagnosis || null
    });

    if (res.error) throw new ApiError('COHORT_QUERY_FAILED', res.error.message);
    return res.data as CohortStat[];
  }
};
