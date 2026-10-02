import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Tabs } from '@/components/ui/Tabs';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { FcGoogle } from 'react-icons/fc';
import { authService } from '@/services/auth.service';
import { Turnstile } from '@/components/security/Turnstile';
import { useAuthStore } from '@/stores/authStore';
import { useUiStore } from '@/stores/uiStore';

const emailSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Minimum 8 characters'),
});
type EmailForm = z.infer<typeof emailSchema>;

export default function Login() {
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [mfaStep, setMfaStep] = useState(false);
  const [mfaCode, setMfaCode] = useState('');
  const [phone, setPhone] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState('');
  const [captcha, setCaptcha] = useState<string>();
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const toast = useUiStore((s) => s.toast);
  const init = useAuthStore((s) => s.init);

  const { register, handleSubmit, formState: { errors } } = useForm<EmailForm>({ resolver: zodResolver(emailSchema) });

  const afterPrimaryAuth = async () => {
    if (await authService.needsMfaChallenge()) { setMfaStep(true); return; }
    await init();
    navigate('/app', { replace: true });
  };

  const onEmail = async (values: EmailForm) => {
    setBusy(true);
    const { error } = await authService.signInEmail(values.email, values.password, captcha);
    setBusy(false);
    if (error) return toast('error', error.message);
    await afterPrimaryAuth();
  };

  const onMfa = async () => {
    setBusy(true);
    try {
      const { error } = await authService.verifyMfaTotp(mfaCode);
      if (error) throw error;
      await init();
      navigate('/app', { replace: true });
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Invalid code');
    } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-soft p-4 dark:bg-surface-dark">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{mfaStep ? 'Two-factor verification' : 'Welcome back'}</h1>
        <p className="mt-1 text-sm text-slate-500">
          {mfaStep ? 'Enter the 6-digit code from your authenticator app.' : 'Sign in to your MedSphere account.'}
        </p>

        {mfaStep ? (
          <div className="mt-6 space-y-4">
            <Input label="Authenticator code" inputMode="numeric" maxLength={6} value={mfaCode}
              onChange={(e) => setMfaCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" autoFocus />
            <Button className="w-full" loading={busy} disabled={mfaCode.length !== 6} onClick={() => void onMfa()}>Verify</Button>
          </div>
        ) : (
          <>
            <div className="mt-6"><Tabs tabs={[{ id: 'email', label: 'Email' }, { id: 'phone', label: 'Phone OTP' }]} active={mode} onChange={setMode} /></div>

            {mode === 'email' ? (
              <form onSubmit={handleSubmit(onEmail)} className="mt-5 space-y-4" noValidate>
                <Input id="email" label="Email" type="email" autoComplete="email" error={errors.email?.message} {...register('email')} />
                <Input id="password" label="Password" type="password" autoComplete="current-password" error={errors.password?.message} {...register('password')} />
                <Turnstile onVerify={setCaptcha} />
                <Button type="submit" className="w-full" loading={busy}>Sign in</Button>
              </form>
            ) : (
              <div className="mt-5 space-y-4">
                {!otpSent ? (
                  <>
                    <Input id="phone" label="Phone (E.164)" placeholder="+8801XXXXXXXXX" value={phone} onChange={(e) => setPhone(e.target.value)} />
                    <Turnstile onVerify={setCaptcha} />
                    <Button className="w-full" loading={busy} onClick={async () => {
                      setBusy(true);
                      const { error } = await authService.sendPhoneOtp(phone, captcha);
                      setBusy(false);
                      if (error) return toast('error', error.message);
                      setOtpSent(true);
                    }}>Send OTP</Button>
                  </>
                ) : (
                  <>
                    <Input id="otp" label="6-digit code" inputMode="numeric" maxLength={6} value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} />
                    <Button className="w-full" loading={busy} onClick={async () => {
                      setBusy(true);
                      const { error } = await authService.verifyPhoneOtp(phone, otp);
                      setBusy(false);
                      if (error) return toast('error', error.message);
                      await afterPrimaryAuth();
                    }}>Verify & sign in</Button>
                  </>
                )}
              </div>
            )}

            <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
              <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" /> or <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
            </div>
            <Button variant="secondary" className="w-full" onClick={() => void authService.signInGoogle()}>
              <FcGoogle className="h-5 w-5" /> Continue with Google
            </Button>
            <p className="mt-5 text-center text-sm text-slate-500">
              New here? <Link to="/register" className="font-medium text-brand-600 hover:underline">Create an account</Link>
            </p>
          </>
        )}
      </Card>
    </div>
  );
}
