import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key-12345678901234567890');
vi.stubEnv('VITE_TURNSTILE_SITE_KEY', '');
vi.stubEnv('VITE_APP_NAME', 'MedSphere AI Test');
