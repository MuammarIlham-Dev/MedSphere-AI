import { z } from 'zod';

const EnvSchema = z.object({
  VITE_SUPABASE_URL: z.string().url(),
  VITE_SUPABASE_ANON_KEY: z.string().min(20),
  VITE_TURNSTILE_SITE_KEY: z.string().default(''),
  VITE_APP_NAME: z.string().default('MedSphere AI'),
});

const parsed = EnvSchema.safeParse(import.meta.env);
if (!parsed.success) {
  // Fail fast at boot — misconfigured env must never reach production traffic.
  throw new Error(`Invalid environment: ${parsed.error.message}`);
}

export const env = {
  supabaseUrl: parsed.data.VITE_SUPABASE_URL,
  supabaseAnonKey: parsed.data.VITE_SUPABASE_ANON_KEY,
  turnstileSiteKey: parsed.data.VITE_TURNSTILE_SITE_KEY,
  appName: parsed.data.VITE_APP_NAME,
  ablyAuthUrl: `${parsed.data.VITE_SUPABASE_URL}/functions/v1/ably-token`,
  isProd: import.meta.env.PROD,
};
