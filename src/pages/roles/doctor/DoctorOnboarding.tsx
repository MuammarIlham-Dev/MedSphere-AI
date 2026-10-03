/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-floating-promises, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument */
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardHeader } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { PageHeader } from '@/components/ui/KpiCard';
import { doctorService } from '@/services/doctor.service';
import { useUiStore } from '@/stores/uiStore';
import { useQueryClient } from '@tanstack/react-query';
import { IoDocumentTextOutline } from 'react-icons/io5';

const schema = z.object({
  specialty: z.string().min(2, 'Specialty is required'),
  license_no: z.string().min(2, 'License number is required'),
  experience_years: z.coerce.number().min(0, 'Must be positive'),
  qualifications: z.string().min(2, 'Please list at least one qualification'),
  consultation_fee: z.coerce.number().min(0, 'Fee cannot be negative'),
});

type Form = z.infer<typeof schema>;

export function DoctorOnboarding({ profileId }: { profileId: string }) {
  const [busy, setBusy] = useState(false);
  const toast = useUiStore((s) => s.toast);
  const queryClient = useQueryClient();

  const { register, handleSubmit, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { experience_years: 0, consultation_fee: 0 },
  });

  const onSubmit = async (values: Form) => {
    setBusy(true);
    try {
      await doctorService.apply(profileId, {
        specialty: values.specialty,
        license_no: values.license_no,
        experience_years: values.experience_years,
        qualifications: values.qualifications.split(',').map(s => s.trim()).filter(Boolean),
        consultation_fee: values.consultation_fee,
      });
      toast('success', 'Application submitted for review');
      queryClient.invalidateQueries({ queryKey: ['my-doctor'] });
    } catch (err: any) {
      toast('error', err.message || 'Failed to submit application');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl pt-8 pb-12">
      <PageHeader
        title="Doctor Application"
        subtitle="Complete your professional profile to practice on MedSphere AI."
      />
      <Card className="mt-6">
        <CardHeader
          title="Professional Credentials"
          subtitle="This information will be reviewed by our administrators before platform access is granted."
        />
        <form onSubmit={handleSubmit(onSubmit)} className="p-6 pt-0 space-y-4">
          <Input
            id="specialty"
            label="Specialty (e.g., Cardiology, General Practice)"
            error={errors.specialty?.message}
            {...register('specialty')}
          />
          <Input
            id="license_no"
            label="Medical License Number"
            error={errors.license_no?.message}
            {...register('license_no')}
          />
          <Input
            id="qualifications"
            label="Qualifications (comma separated)"
            placeholder="MBBS, MD"
            error={errors.qualifications?.message}
            {...register('qualifications')}
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              id="experience_years"
              type="number"
              label="Years of Experience"
              error={errors.experience_years?.message}
              {...register('experience_years')}
            />
            <Input
              id="consultation_fee"
              type="number"
              label="Consultation Fee ($)"
              error={errors.consultation_fee?.message}
              {...register('consultation_fee')}
            />
          </div>
          
          <div className="mt-6 flex items-center justify-between rounded-xl bg-slate-50 p-4 dark:bg-white/5">
            <div className="flex items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
              <IoDocumentTextOutline className="h-5 w-5 text-brand-600 dark:text-brand-400" />
              <span>By submitting, you agree to our terms for medical practitioners.</span>
            </div>
            <Button type="submit" loading={busy}>Submit application</Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
