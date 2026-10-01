import { supabase } from '@/lib/supabase';
import { ApiError } from '@/lib/api';
export const authService = {
  signInEmail: (email: string, password: string, captchaToken?: string) =>
    supabase.auth.signInWithPassword({ email, password, options: { captchaToken } }),

  signUpEmail: (email: string, password: string, fullName: string, role: string, captchaToken?: string) =>
    supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName, role }, captchaToken, emailRedirectTo: window.location.origin },
    }),

  signInGoogle: () =>
    supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}/app` } }),

  sendPhoneOtp: (phone: string, captchaToken?: string) =>
    supabase.auth.signInWithOtp({ phone, options: { captchaToken } }),

  verifyPhoneOtp: (phone: string, token: string) =>
    supabase.auth.verifyOtp({ phone, token, type: 'sms' }),

  resetPassword: (email: string) =>
    supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/reset` }),

  /** True when user authenticated at AAL1 but must complete TOTP (AAL2). */
  needsMfaChallenge: async () => {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    return data?.nextLevel === 'aal2' && data.currentLevel !== 'aal2';
  },

  verifyMfaTotp: async (code: string) => {
    const factors = await supabase.auth.mfa.listFactors();
    const totp = factors.data?.totp[0];
    if (!totp) throw new ApiError('MFA_NONE', 'No TOTP factor enrolled');
    const challenge = await supabase.auth.mfa.challenge({ factorId: totp.id });
    if (challenge.error) throw challenge.error;
    return supabase.auth.mfa.verify({ factorId: totp.id, challengeId: challenge.data.id, code });
  },

  enrollTotp: () => supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'MedSphere Authenticator' }),
};
