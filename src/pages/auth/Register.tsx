import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input, Select } from '@/components/ui/Input';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authService } from '@/services/auth.service';
import { Turnstile } from '@/components/security/Turnstile';
import { useUiStore } from '@/stores/uiStore';

const schema = z.object({
  full_name: z.string().min(2, 'Enter your full name'),
  email: z.string().email(),
  password: z.string().min(10, 'Minimum 10 characters')
    .regex(/[A-Z]/, 'Add an uppercase letter').regex(/[0-9]/, 'Add a number'),
  role: z.enum(['citizen', 'doctor', 'hospital', 'laboratory', 'pharmacy', 'blood_bank', 'volunteer']),
});
type Form = z.infer<typeof schema>;

const STAFF_ROLES = new Set(['doctor', 'hospital', 'laboratory', 'pharmacy', 'blood_bank']);

export default function Register() {
  const [captcha, setCaptcha] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const navigate = useNavigate();
  const toast = useUiStore((s) => s.toast);
  const { register, handleSubmit, watch, formState: { errors } } = useForm<Form>({
    resolver: zodResolver(schema), defaultValues: { role: 'citizen' },
  });
  const role = watch('role');

  const onSubmit = async (values: Form) => {
    setBusy(true);
    const { error } = await authService.signUpEmail(values.email, values.password, values.full_name, values.role, captcha);
    setBusy(false);
    if (error) return toast('error', error.message);
    setDone(true);
  };

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <Card className="w-full max-w-md p-8 text-center">
          <h1 className="text-xl font-semibold">Check your inbox</h1>
          <p className="mt-2 text-sm text-slate-500">
            We sent a confirmation link to your email.
            {STAFF_ROLES.has(role) && ' After confirming, your professional access request will be retained for administrative onboarding; operational access remains disabled until provisioned.'}
          </p>
          <Button className="mt-6" onClick={() => navigate('/login')}>Back to sign in</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-soft px-4 py-8 sm:p-4 dark:bg-surface-dark">
      <Card className="w-full max-w-md p-5 sm:p-8 shadow-card">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">Your Digital Health ID is generated automatically.</p>
        <form onSubmit={handleSubmit(onSubmit)} className="mt-6 space-y-4" noValidate>
          <Input id="full_name" label="Full name" error={errors.full_name?.message} {...register('full_name')} />
          <Input id="email" label="Email" type="email" error={errors.email?.message} {...register('email')} />
          <Input id="password" label="Password" type="password" error={errors.password?.message} {...register('password')} />
          <Select id="role" label="I am joining as" error={errors.role?.message} {...register('role')}>
            <option value="citizen">Citizen</option>
            <option value="doctor">Doctor (requires verification)</option>
            <option value="hospital">Hospital (requires verification)</option>
            <option value="laboratory">Laboratory (requires verification)</option>
            <option value="pharmacy">Pharmacy (requires verification)</option>
            <option value="blood_bank">Blood Bank (requires verification)</option>
            <option value="volunteer">Volunteer</option>
          </Select>
          {STAFF_ROLES.has(role) && (
            <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              Professional signup is a request only. Your account remains a citizen until an administrator provisions the requested operational role and completes verification.
            </p>
          )}
          <Turnstile onVerify={setCaptcha} />
          <Button type="submit" className="w-full" loading={busy}>Create account</Button>
        </form>
        <p className="mt-5 text-center text-sm text-slate-500">
          Already registered? <Link to="/login" className="font-medium text-brand-600 hover:underline">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
