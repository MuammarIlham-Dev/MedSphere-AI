import { useMutation, useQuery } from'@tanstack/react-query';
import { aiService, SymptomPayload, AiSymptomResponse } from'@/lib/ai.service';
import { useUiStore } from'@/stores/uiStore';

export function useSymptomChecker() {
 const toast = useUiStore((s) => s.toast);
 return useMutation<AiSymptomResponse, Error, SymptomPayload>({
 mutationFn: (payload) => aiService.checkSymptoms(payload),
 onError: (err) => {
 toast('error', `AI Assistant Error: ${err.message}`);
 }
 });
}

export function useTimelineSummarizer(records: unknown[], enabled = true) {
 return useQuery({
 queryKey: ['ai-timeline', records],
 queryFn: () => aiService.summarizeTimeline(records),
 enabled: enabled && records.length > 0,
 staleTime: 1000 * 60 * 60, // 1 hour caching for AI summaries
 });
}

export function useDemandForecast(history: unknown[], enabled = true) {
 return useQuery({
 queryKey: ['ai-forecast', history],
 queryFn: () => aiService.forecastDemand(history),
 enabled: enabled && history.length > 0,
 staleTime: 1000 * 60 * 60,
 });
}
