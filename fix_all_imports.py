"""
Comprehensive import fixer for MedSphere AI.
Adds missing imports that were stripped during extraction.
"""
import os, re

# Map of (file_path, exact_content_to_prepend) — we rewrite each file fully
fixes = {}

def read(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def write(path, content):
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f"  Fixed: {path}")

# ── src/lib/supabase.ts ──────────────────────────────────────────
p = 'src/lib/supabase.ts'
c = read(p)
if "import { env }" not in c:
    c = "import { env } from './env';\n" + c
    write(p, c)

# ── src/lib/ably.ts ──────────────────────────────────────────────
p = 'src/lib/ably.ts'
c = read(p)
if "import { env }" not in c:
    c = "import { env } from './env';\n" + c
    write(p, c)

# ── src/lib/gsap.ts ──────────────────────────────────────────────
p = 'src/lib/gsap.ts'
c = read(p)
if 'isReducedMotion' in c and "const isReducedMotion" not in c:
    c = "const isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;\n" + c
    write(p, c)

# ── src/lib/utils.ts ──────────────────────────────────────────────
p = 'src/lib/utils.ts'
c = read(p)
if 'export function initials' not in c:
    c += "\nexport function initials(name: string): string {\n  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();\n}\n"
    write(p, c)

# ── src/components/security/Turnstile.tsx ────────────────────────
p = 'src/components/security/Turnstile.tsx'
c = read(p)
needs = []
if "import { useRef, useEffect }" not in c and "useRef" in c:
    needs.append("import { useRef, useEffect } from 'react';")
if "import { env }" not in c and "env." in c:
    needs.append("import { env } from '@/lib/env';")
if needs:
    c = '\n'.join(needs) + '\n' + c
    write(p, c)

# ── src/components/transitions/PageTransition.tsx ────────────────
p = 'src/components/transitions/PageTransition.tsx'
c = read(p)
needs = []
if 'PropsWithChildren' in c and "import type { PropsWithChildren }" not in c and "PropsWithChildren" not in c.split('\n')[0]:
    needs.append("import type { PropsWithChildren } from 'react';")
if 'useRef' in c and "import { useRef }" not in c:
    needs.append("import { useRef } from 'react';")
if 'usePageEnter' in c and "import { usePageEnter }" not in c:
    needs.append("import { usePageEnter } from '@/lib/gsap';")
if needs:
    c = '\n'.join(needs) + '\n' + c
    write(p, c)

# ── src/components/ui/Badge.tsx ──────────────────────────────────
p = 'src/components/ui/Badge.tsx'
c = read(p)
if 'ReactNode' in c and "import type { ReactNode }" not in c:
    c = "import type { ReactNode } from 'react';\n" + c
    write(p, c)

# ── src/components/ui/KpiCard.tsx ────────────────────────────────
p = 'src/components/ui/KpiCard.tsx'
c = read(p)
if 'ReactNode' in c and "import type { ReactNode }" not in c:
    c = "import type { ReactNode } from 'react';\n" + c
    write(p, c)

# ── src/components/ui/Modal.tsx ──────────────────────────────────
p = 'src/components/ui/Modal.tsx'
c = read(p)
if 'ReactNode' in c and "import type { ReactNode }" not in c:
    c = "import type { ReactNode } from 'react';\n" + c
    write(p, c)

# ── src/components/ui/ToastHost.tsx ──────────────────────────────
p = 'src/components/ui/ToastHost.tsx'
c = read(p)
if 'IoClose' in c and "import { IoClose" not in c and "IoCloseOutline" not in c:
    c = "import { IoCloseOutline } from 'react-icons/io5';\n" + c
    c = c.replace('<IoClose ', '<IoCloseOutline ')
    c = c.replace('<IoClose/', '<IoCloseOutline/')
    write(p, c)

# ── src/components/auth/ProtectedRoute.tsx ───────────────────────
p = 'src/components/auth/ProtectedRoute.tsx'
c = read(p)
if 'FullPageLoader' in c and "import { FullPageLoader" not in c and "import { Spinner, FullPageLoader }" not in c:
    c = "import { FullPageLoader } from '@/components/ui/Spinner';\n" + c
    write(p, c)

# ── src/components/layout/AppShell.tsx ───────────────────────────
p = 'src/components/layout/AppShell.tsx'
c = read(p)
needs = []
if 'ReactNode' in c and "import type { ReactNode }" not in c:
    needs.append("import type { ReactNode } from 'react';")
if 'ToastHost' in c and "import { ToastHost" not in c:
    needs.append("import { ToastHost } from '@/components/ui/ToastHost';")
if needs:
    c = '\n'.join(needs) + '\n' + c
    write(p, c)

# ── src/stores/authStore.ts ──────────────────────────────────────
p = 'src/stores/authStore.ts'
c = read(p)
needs = []
if 'supabase' in c and "import { supabase }" not in c:
    needs.append("import { supabase } from '@/lib/supabase';")
if 'closeAbly' in c and "import { closeAbly }" not in c:
    needs.append("import { closeAbly } from '@/lib/ably';")
if 'queryClient' in c and "import { queryClient }" not in c:
    needs.append("import { queryClient } from '@/lib/queryClient';")
if needs:
    c = '\n'.join(needs) + '\n' + c
    write(p, c)

# ── HOOKS: Add missing imports ───────────────────────────────────

# useAuth.ts
p = 'src/hooks/useAuth.ts'
c = read(p)
if 'useEffect' in c and "import { useEffect }" not in c:
    c = "import { useEffect } from 'react';\n" + c
    write(p, c)

# useAppointments.ts
p = 'src/hooks/useAppointments.ts'
c = read(p)
needs = []
if 'appointmentService' in c and "import { appointmentService" not in c:
    needs.append("import { appointmentService } from '@/services/appointment.service';")
if 'useQueryClient' in c and "import { useQueryClient" not in c and "useQueryClient" not in c.split('\n')[1] if len(c.split('\n'))>1 else True:
    needs.append("import { useQueryClient, useMutation } from '@tanstack/react-query';")
if 'useEffect' in c and "import { useEffect }" not in c:
    needs.append("import { useEffect } from 'react';")
if 'useUiStore' in c and "import { useUiStore }" not in c:
    needs.append("import { useUiStore } from '@/stores/uiStore';")
if 'AppointmentStatus' in c and "import type { AppointmentStatus" not in c:
    needs.append("import type { AppointmentStatus } from '@/types';")
if needs:
    c = '\n'.join(needs) + '\n' + c
    write(p, c)

# useDoctors.ts
p = 'src/hooks/useDoctors.ts'
c = read(p)
needs = []
if 'doctorService' in c and "import { doctorService" not in c:
    needs.append("import { doctorService } from '@/services/doctor.service';")
if 'DoctorSearchFilters' in c and "import type { DoctorSearchFilters" not in c:
    needs.append("import type { DoctorSearchFilters } from '@/types';")
if 'keepPreviousData' in c and "import { keepPreviousData }" not in c:
    needs.append("import { keepPreviousData } from '@tanstack/react-query';")
if needs:
    c = '\n'.join(needs) + '\n' + c
    write(p, c)

# useBlood.ts
p = 'src/hooks/useBlood.ts'
c = read(p)
needs = []
if 'bloodService' in c and "import { bloodService" not in c:
    needs.append("import { bloodService } from '@/services/blood.service';")
if 'useQueryClient' in c and "useQueryClient" not in c.split('\n')[0]:
    needs.append("import { useQueryClient, useMutation } from '@tanstack/react-query';")
if 'useEffect' in c and "import { useEffect }" not in c:
    needs.append("import { useEffect } from 'react';")
if 'useUiStore' in c and "import { useUiStore }" not in c:
    needs.append("import { useUiStore } from '@/stores/uiStore';")
if needs:
    c = '\n'.join(needs) + '\n' + c
    write(p, c)

# useChat.ts
p = 'src/hooks/useChat.ts'
c = read(p)
needs = []
if 'chatService' in c and "import { chatService" not in c:
    needs.append("import { chatService } from '@/services/chat.service';")
if 'useQueryClient' in c and "useQueryClient" not in c.split('\n')[0]:
    needs.append("import { useQueryClient, useMutation } from '@tanstack/react-query';")
if 'useState' in c and "import { useState" not in c:
    needs.append("import { useState, useEffect, useRef } from 'react';")
if 'ablyChannel' in c and "import { ablyChannel, publish }" not in c:
    needs.append("import { ablyChannel, publish } from '@/lib/ably';")
if 'ChatMessage' in c and "import type { ChatMessage" not in c:
    needs.append("import type { ChatMessage, AblyEventMap } from '@/types';")
if needs:
    c = '\n'.join(needs) + '\n' + c
    write(p, c)

# useEmergency.ts
p = 'src/hooks/useEmergency.ts'
c = read(p)
needs = []
if 'emergencyService' in c and "import { emergencyService" not in c:
    needs.append("import { emergencyService } from '@/services/emergency.service';")
if 'useQueryClient' in c and "useQueryClient" not in c.split('\n')[0]:
    needs.append("import { useQueryClient, useMutation } from '@tanstack/react-query';")
if 'useEffect' in c and "import { useEffect" not in c:
    needs.append("import { useEffect, useState } from 'react';")
if 'useUiStore' in c and "import { useUiStore }" not in c:
    needs.append("import { useUiStore } from '@/stores/uiStore';")
if 'ablyChannel' in c and "import { ablyChannel }" not in c:
    needs.append("import { ablyChannel } from '@/lib/ably';")
if needs:
    c = '\n'.join(needs) + '\n' + c
    write(p, c)

# useOrgan.ts
p = 'src/hooks/useOrgan.ts'
c = read(p)
needs = []
if 'organService' in c and "import { organService" not in c:
    needs.append("import { organService } from '@/services/organ.service';")
if 'useQueryClient' in c and "useQueryClient" not in c.split('\n')[0]:
    needs.append("import { useQueryClient, useMutation } from '@tanstack/react-query';")
if 'useUiStore' in c and "import { useUiStore }" not in c:
    needs.append("import { useUiStore } from '@/stores/uiStore';")
if needs:
    c = '\n'.join(needs) + '\n' + c
    write(p, c)

# useAdmin.ts
p = 'src/hooks/useAdmin.ts'
c = read(p)
needs = []
if 'adminService' in c and "import { adminService" not in c:
    needs.append("import { adminService } from '@/services/admin.service';")
if 'useQueryClient' in c and "useQueryClient" not in c.split('\n')[0]:
    needs.append("import { useQueryClient, useMutation } from '@tanstack/react-query';")
if 'useUiStore' in c and "import { useUiStore }" not in c:
    needs.append("import { useUiStore } from '@/stores/uiStore';")
if needs:
    c = '\n'.join(needs) + '\n' + c
    write(p, c)

# useNotifications.ts
p = 'src/hooks/useNotifications.ts'
c = read(p)
needs = []
if 'notificationService' in c and "import { notificationService" not in c:
    needs.append("import { notificationService } from '@/services/notification.service';")
if 'useQueryClient' in c and "useQueryClient" not in c.split('\n')[0]:
    needs.append("import { useQueryClient } from '@tanstack/react-query';")
if 'useEffect' in c and "import { useEffect" not in c:
    needs.append("import { useEffect } from 'react';")
if 'useUiStore' in c and "import { useUiStore }" not in c:
    needs.append("import { useUiStore } from '@/stores/uiStore';")
if 'ablyChannel' in c and "import { ablyChannel }" not in c:
    needs.append("import { ablyChannel } from '@/lib/ably';")
if 'AblyEventMap' in c and "import type { AblyEventMap" not in c:
    needs.append("import type { AblyEventMap } from '@/types';")
if needs:
    c = '\n'.join(needs) + '\n' + c
    write(p, c)

# ── SERVICES ─────────────────────────────────────────────────────

# chat.service.ts
p = 'src/services/chat.service.ts'
c = read(p)
if 'publish' in c and "import { publish }" not in c:
    c = "import { publish } from '@/lib/ably';\n" + c
    write(p, c)

# emergency.service.ts
p = 'src/services/emergency.service.ts'
c = read(p)
if 'publish' in c and "import { publish }" not in c:
    c = "import { publish } from '@/lib/ably';\n" + c
    write(p, c)

# doctor.service.ts
p = 'src/services/doctor.service.ts'
c = read(p)
needs = []
if 'TimeSlot' in c and "interface TimeSlot" not in c and "type TimeSlot" not in c:
    # Add TimeSlot inline
    needs.append("export interface TimeSlot { start: string; end: string; type: 'video' | 'clinic'; available: boolean; }")
if 'generateSlots' in c and "function generateSlots" not in c:
    needs.append("""
function generateSlots(date: string, startH: number, endH: number, type: 'video' | 'clinic'): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let h = startH; h < endH; h++) {
    for (const m of [0, 20, 40]) {
      const start = `${date}T${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:00`;
      const eh = m === 40 ? h + 1 : h;
      const em = m === 40 ? 0 : m + 20;
      const end = `${date}T${String(eh).padStart(2,'0')}:${String(em).padStart(2,'0')}:00`;
      slots.push({ start, end, type, available: Math.random() > 0.3 });
    }
  }
  return slots;
}
""")
if needs:
    c = '\n'.join(needs) + '\n' + c
    write(p, c)

# ── src/sw.ts ────────────────────────────────────────────────────
p = 'src/sw.ts'
if os.path.exists(p):
    c = read(p)
    if 'skipWaiting' in c and 'declare var self' not in c:
        c = "/// <reference lib=\"webworker\" />\ndeclare var self: ServiceWorkerGlobalScope;\n" + c
        write(p, c)

print("\n✅ All import fixes applied.")
