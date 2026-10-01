import { supabase } from './supabase';
import { ApiError } from './api';

export type AiTaskType = 'symptom_check' | 'summarize_timeline' | 'forecast_demand';

export interface SymptomPayload {
  symptoms: string;
  duration: string;
  severity: string;
  history?: string;
}

export interface AiSymptomResponse {
  guidance: string;
  confidence: 'High' | 'Medium' | 'Low';
  disclaimer: boolean;
}

export interface AiTimelineResponse {
  summary: string;
}

export interface AiForecastResponse {
  forecast: string;
  confidence: 'High' | 'Medium' | 'Low';
}

export const aiService = {
  async invokeTask<T>(task: AiTaskType, payload: unknown): Promise<T> {
    const response = (await supabase.functions.invoke('ai-assistant', {
      body: { task, payload }
    })) as { data: unknown; error: unknown };
    
    const rawData = response.data;
    const error = response.error;
    
    if (error) {
      console.error('AI Edge Function Error:', error);
      throw new ApiError('AI_INVOCATION_FAILED', 'Failed to get a response from the AI assistant.');
    }
    
    const data = rawData as Record<string, unknown> | null;
    if (data && typeof data.error === 'string') {
      throw new ApiError('AI_INTERNAL_ERROR', data.error);
    }
    
    return data as T;
  },

  async checkSymptoms(payload: SymptomPayload): Promise<AiSymptomResponse> {
    return this.invokeTask<AiSymptomResponse>('symptom_check', payload);
  },

  async summarizeTimeline(records: unknown[]): Promise<AiTimelineResponse> {
    return this.invokeTask<AiTimelineResponse>('summarize_timeline', { records });
  },

  async forecastDemand(history: unknown[]): Promise<AiForecastResponse> {
    return this.invokeTask<AiForecastResponse>('forecast_demand', { history });
  }
};
