# MedSphere AI

**National Intelligent Public Health & Emergency Response Platform** — a production-grade PWA connecting citizens, doctors, hospitals, ambulances, blood banks, organ authorities, labs, pharmacies, government and researchers.

> ⚕️ **Safety posture:** AI features are strictly assistive and informational. The organ matching engine assists authorized coordinators — it never makes autonomous transplant decisions. Nothing on the platform replaces licensed clinical judgment.

---

## 1. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React 19, Vite 6, TypeScript, React Router 7 |
| Styling | Tailwind CSS 3.4 (Material-3 / Fluent-inspired tokens) |
| Animation | GSAP 3 (Framer Motion only if GSAP can't) |
| Data | TanStack Query 5, Zustand 5 |
| Forms | React Hook Form + Zod |
| Charts | Chart.js 4 |
| Backend | Supabase (Postgres, Auth, RLS, Storage, Edge Functions, Realtime) |
| Realtime | Ably (presence, chat, SOS, tracking, notifications) |
| Deploy | Cloudflare Pages, Turnstile, CDN, Analytics |
| Testing | Vitest, Testing Library, Playwright |

---

## 2. Repository Structure

```
medsphere-ai/
├── .github/workflows/ci.yml          # CI/CD pipeline
├── public/
│   ├── _headers                      # CSP + security headers (Cloudflare Pages)
│   ├── _redirects                    # SPA fallback
│   ├── offline.html                  # PWA offline fallback
│   └── icons/                        # PWA icons (192/512, maskable)
├── supabase/
│   ├── config.toml
│   ├── migrations/
│   │   ├── 0001_extensions_enums.sql
│   │   ├── 0002_core_tables.sql
│   │   ├── 0003_functions_triggers.sql
│   │   └── 0004_rls_realtime_storage.sql
│   └── functions/
│       └── ably-token/index.ts       # Ably token issuing (role-scoped capabilities)
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── vite-env.d.ts
│   ├── types/                        # Domain model (enums, entities, DTOs)
│   ├── lib/                          # env, supabase, ably, queryClient, utils, gsap
│   ├── stores/                       # authStore, uiStore (Zustand)
│   ├── services/                     # API layer: auth, doctors, appointments, organ,
│   │                                 # blood, emergency, chat, notifications, admin
│   ├── hooks/                        # useAuth, useDoctorSearch, useAppointments,
│   │                                 # useOrganMatches, useChat, useSOS, usePresence…
│   ├── components/
│   │   ├── ui/                       # Button, Card, Input, Modal, Badge, KpiCard…
│   │   ├── charts/ChartCard.tsx      # Chart.js wrapper
│   │   ├── layout/AppShell.tsx       # Role-aware sidebar/topbar shell
│   │   ├── auth/                     # ProtectedRoute, RoleGate
│   │   ├── security/Turnstile.tsx
│   │   └── transitions/PageTransition.tsx
│   ├── pages/
│   │   ├── Landing.tsx
│   │   ├── auth/{Login,Register}.tsx
│   │   ├── citizen/CitizenDashboard.tsx
│   │   ├── doctor/DoctorDashboard.tsx
│   │   ├── hospital/HospitalDashboard.tsx
│   │   ├── appointments/DoctorSearch.tsx
│   │   ├── telemedicine/ConsultationRoom.tsx
│   │   ├── organ/OrganDashboard.tsx
│   │   ├── blood/BloodBankDashboard.tsx
│   │   ├── emergency/EmergencySOS.tsx
│   │   ├── emergency/EmergencyDashboard.tsx
│   │   ├── emergency/AmbulanceDriverDashboard.tsx
│   │   ├── emergency/EmergencyAgencyDashboard.tsx
│   │   ├── government/GovDashboard.tsx
│   │   └── admin/AdminDashboard.tsx
│   └── test/                         # setup, unit + component tests
├── e2e/                              # Playwright specs
├── supabase/functions/
├── .env.example
├── eslint.config.js  .prettierrc  tailwind.config.ts  postcss.config.js
├── vite.config.ts  tsconfig.json  wrangler.toml  package.json
└── README.md
```

---

## 3. Quick Start

**Prerequisites:** Node 20+, pnpm 9+, Supabase CLI, an Ably account, a Cloudflare account.

```bash
pnpm install
cp .env.example .env            # fill in values (see section 4)

# Local Supabase (Postgres + Auth + Storage + Edge runtime)
supabase start
supabase db push                # applies migrations 0001–0004
pnpm db:types                   # regenerates src/types/database.types.ts

# Secrets for the local edge function
supabase secrets set ABLY_API_KEY=key_name:key_secret

pnpm dev                        # http://localhost:5173
```

## 4. Environment Variables

| Variable | Scope | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | client | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | client | Public anon key (safe — RLS enforced) |
| `VITE_TURNSTILE_SITE_KEY` | client | Cloudflare Turnstile site key |
| `VITE_APP_NAME` | client | Display name |
| `ABLY_API_KEY` | **server (edge secret)** | Used by `ably-token` function only |
| `SUPABASE_SERVICE_ROLE_KEY` | **server (edge secret)** | Auto-injected into edge functions |

The service-role key **never** ships to the browser. All privileged logic lives in SQL `security definer` functions or edge functions. Emergency responder roles cannot self-register; an administrator must provision the role and agency membership.

## 5. Scripts

```bash
pnpm dev | build | preview
pnpm lint | format | typecheck
pnpm test            # Vitest unit/component
pnpm test:e2e        # Playwright
pnpm db:types        # supabase gen types typescript --local > src/types/database.types.ts
```

---

## 6. Architecture

**Layering (Clean Architecture, feature-based):**

```
pages → components → hooks (TanStack Query) → services (typed API) → supabase/ably
                     ↘ stores (client-only UI/session state) ↗
```

- **Services** are the only modules that talk to Supabase/Ably. Components never call Supabase directly.
- **Hooks** wrap services with caching, optimistic updates and realtime invalidation.
- **Stores** hold *client-only* state (theme, sidebar, toasts, auth session mirror). Server state lives in TanStack Query — never duplicated into Zustand.
- **Authorization is defense-in-depth:** RLS in Postgres is the hard boundary; `RoleGate`/`ProtectedRoute` are UX guards only.

**Auth flow:** Sign up/in (email+password w/ Turnstile, Google OAuth, or phone OTP) → DB trigger creates `profiles` row with role from metadata → if TOTP MFA enrolled, AAL2 challenge is required before entering the shell → role-based onboarding (doctors/hospitals enter `pending` verification, visible in Admin queue).

**Realtime map (Ably channel conventions):**

| Channel | Purpose | Who |
|---|---|---|
| `notify:user:{id}` | Priority notifications | owner subscribes |
| `presence:doctors` | Online doctor presence | everyone subscribes, doctors enter |
| `chat:{conversationId}` | Messages, typing, read receipts | participants |
| `track:ambulance:{id}` | Live GPS stream | assigned driver publishes; authorized operators/citizen receive |
| `sos:operator:{city}` | Regional SOS dispatch events | authorized dispatch operators/government |
| `sos:emergency:{id}` | Per-incident lifecycle updates | reporter + authorized responders |
| `sos:ambulance:{id}` | Dispatch offers/lifecycle updates | assigned ambulance driver |
| `sos:agency:{id}` | Fire/Police/Rescue/EMS agency dispatch | verified agency members |
| `sos:*` / generic tracking | Legacy realtime surface | retained only for non-emergency modules; Emergency SOS uses the scoped channels above |

Supabase remains authoritative for durable emergency state and auditability. Ably carries high-frequency ambulance GPS and low-latency SOS dispatch/lifecycle events; database polling remains the recovery path when realtime is unavailable. Emergency SOS mutations are server-authorized through Supabase RPCs and a trusted Ably event gateway.

---

## 7. Testing Strategy

| Layer | Tool | Target | Examples |
|---|---|---|---|
| Unit | Vitest | 80% lines on `lib/`, `services/`, utils | blood-compatibility matrix, slot generator, priority scoring mirror |
| Component | Testing Library | all `components/ui` + critical flows | Modal focus trap, Button variants, Login MFA step |
| Contract | Vitest + `supabase functions serve` | edge functions | ably-token returns role-scoped capability |
| E2E | Playwright | golden paths | register→book appointment; donor register→match review; SOS dispatch |
| RLS | pgTAP (optional) / SQL tests | every policy | citizen cannot read another citizen's records |

```bash
pnpm test -- --coverage     # CI gate: ≥80% on changed files
pnpm test:e2e -- --project=chromium
```

**Fixtures:** seed script creates 1 admin, 2 hospitals, 5 doctors, 20 citizens, inventory rows. E2E runs against `supabase start` in CI.

---

## 8. CI/CD (`.github/workflows/ci.yml`)

```yaml
name: ci
on: [push, pull_request]
concurrency: { group: ${{ github.ref }}, cancel-in-progress: true }
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint && pnpm typecheck
      - run: pnpm test -- --coverage --reporter=default
  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: supabase/setup-cli@v1
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: supabase start && supabase db push
      - run: pnpm build
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm test:e2e
  deploy:
    if: github.ref == 'refs/heads/main'
    needs: [quality, e2e]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: pnpm install --frozen-lockfile && pnpm build
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=medsphere-ai
      - run: pnpm exec supabase link --project-ref ${{ secrets.SUPABASE_PROJECT_REF }}
           && pnpm exec supabase db push
           && pnpm exec supabase functions deploy ably-token
```

**Recommendations:** PRs deploy to Cloudflare Pages preview branches automatically; `main` is protected, requires 1 review + green checks; use Changesets if you split packages later; run `pnpm dlx lighthouse-ci` against the preview URL as a budget gate (Performance ≥95, A11y ≥100 target).

---

## 9. Production Deployment Guide

**Supabase**
1. Create project → Settings → API: copy URL + anon key.
2. `supabase link --project-ref <ref>` → `supabase db push`.
3. Auth providers: enable Email (confirm email ON), Google (OAuth client), Phone (Twilio/MessageBird). Enable TOTP MFA.
4. Captcha: paste Turnstile **secret** into Supabase Auth → Bot protection.
5. `supabase secrets set ABLY_API_KEY=...`.
6. Deploy realtime functions: `supabase functions deploy ably-token`, `supabase functions deploy blood-ably-token`, `supabase functions deploy blood-ably-event`, `supabase functions deploy emergency-ably-token`, `supabase functions deploy emergency-ably-event`, and `supabase functions deploy emergency-escalation`.
7. Apply migrations in order through the latest migration (currently `0035_emergency_multi_agency.sql`).
8. Set `EMERGENCY_ESCALATION_SECRET` and schedule the `emergency-escalation` function from a server-side scheduler at a short interval.
9. Provision verified emergency agencies and responder membership through the administrator-only RPCs.

**Ably** — Create app → restrict API key; no client-side key is ever used (token auth only).

**Cloudflare Pages**
1. Connect repo → build command `pnpm build`, output `dist`.
2. Env vars: the three `VITE_*` vars.
3. `public/_headers` + `public/_redirects` are picked up automatically (CSP, HSTS, SPA fallback).
4. Turnstile: create widget, add site key to Pages env + secret to Supabase Auth.
5. Enable Web Analytics + Web Vitals; add custom domain (proxied, HTTPS enforced).
6. Rollback: Pages keeps every deploy — one click in dashboard.

**Post-launch:** schedule `pg_cron` job to expire stale blood requests/organ matches; set up Supabase log drains; add Sentry (DSN in env) behind consent.

---

## 10. Security & Accessibility Checklists

- [x] RLS on **every** table; policies least-privilege, tested
- [x] MFA (TOTP), session + device management via Supabase Auth
- [x] Turnstile on auth mutations; rate limits at Cloudflare edge
- [x] Strict CSP in `_headers`; no `dangerouslySetInnerHTML`; Zod-validated inputs
- [x] File uploads: mime + size + SHA-256 recorded; private buckets only
- [x] Audit trigger on sensitive tables; immutable `audit_logs`
- [x] WCAG 2.2 AA: semantic HTML, focus-visible rings, 4.5:1 contrast tokens, `prefers-reduced-motion` honored in every GSAP path, keyboard-operable modals/tabs, aria-live toast region

---

## 11. Roadmap

| Phase | Scope |
|---|---|
| **1 — Foundation (this build)** | Auth+MFA, citizen/doctor/hospital cores, appointments, organ matching assist, blood, SOS, gov/admin dashboards, PWA |
| **2 — Care delivery** | Video provider integration (Daily/Twilio), e-pharmacy fulfillment, lab sample tracking UI, calendar sync (CalDAV/Google) |
| **3 — Intelligence** | AI symptom guidance (LLM via edge function w/ safety rails + confidence UI), timeline summarizer, demand forecasting for blood/beds |
| **4 — National scale** | Wearable ingestion (FHIR R4 adapter), HL7/FHIR interoperability gateway, regional data residency, disaster-mode offline-first mesh sync |
| **5 — Research** | Anonymized cohort explorer, differential-privacy query API, ethics-review workflow |

*Every AI output ships with: informational labeling, confidence indicator, disclaimer, and one-tap escalation to a professional.*