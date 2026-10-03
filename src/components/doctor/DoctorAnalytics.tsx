import React, { useMemo } from 'react';
import { ChartCard } from '@/components/charts/ChartCard';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Skeleton } from '@/components/ui/KpiCard';

interface AnalyticsData {
  videoCount: number;
  clinicCount: number;
  totalRevenue: number;
  completedCount: number;
  ratingAvg: string;
  ratingCount: number;
}

export function DoctorAnalytics({ doctorId }: { doctorId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['doctor_analytics', doctorId],
    queryFn: async () => {
      const start = new Date();
      start.setDate(start.getDate() - 30);
      const { data: rows, error } = await supabase
        .from('appointments')
        .select(`
          type, 
          status, 
          amount_charged,
          appointment_feedback ( rating )
        `)
        .eq('doctor_id', doctorId)
        .eq('status', 'completed')
        .gte('scheduled_at', start.toISOString());
      
      if (error) throw error;

      let videoCount = 0;
      let clinicCount = 0;
      let totalRevenue = 0;
      let ratingSum = 0;
      let ratingCount = 0;

      for (const row of rows || []) {
        if (row.type === 'video') videoCount++;
        if (row.type === 'clinic') clinicCount++;
        
        totalRevenue += (row.amount_charged || 0);
        
        // appointment_feedback can be an array if there are multiple feedbacks (though there should only be one)
        const feedback = Array.isArray(row.appointment_feedback) 
          ? row.appointment_feedback[0] 
          : row.appointment_feedback;
          
        if (feedback && typeof feedback.rating === 'number') {
          ratingSum += feedback.rating;
          ratingCount++;
        }
      }

      const ratingAvg = ratingCount > 0 ? (ratingSum / ratingCount).toFixed(1) : 'N/A';

      return {
        videoCount,
        clinicCount,
        completedCount: (rows || []).length,
        totalRevenue,
        ratingAvg,
        ratingCount
      };
    },
    enabled: !!doctorId
  });

  if (isLoading) {
    return (
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  const { videoCount = 0, clinicCount = 0, totalRevenue = 0, completedCount = 0 } = data || {};

  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-3">
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-surface-dark">
        <h3 className="text-sm font-medium text-slate-500">30-Day Revenue</h3>
        <p className="mt-2 text-3xl font-semibold">৳{totalRevenue}</p>
        <p className="mt-1 text-xs text-slate-400">Based on {completedCount} completed consultations</p>
      </div>

      <ChartCard title="Consultation mix (30 days)" config={{
        type: 'doughnut',
        data: {
          labels: ['Video', 'Clinic'],
          datasets: [{ data: [videoCount || 0.1, clinicCount || 0.1], backgroundColor: ['#0891b2', '#67e8f9'] }],
        },
      }} />

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-white/10 dark:bg-surface-dark">
        <h3 className="text-sm font-medium text-slate-500">Patient Ratings</h3>
        <p className="mt-2 text-3xl font-semibold">{data?.ratingAvg === 'N/A' ? 'N/A' : `${data?.ratingAvg} / 5.0`}</p>
        <p className="mt-1 text-xs text-slate-400">From {data?.ratingCount} verified reviews</p>
      </div>
    </div>
  );
}
