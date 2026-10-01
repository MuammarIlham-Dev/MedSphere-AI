import { create } from 'zustand';

export type Theme = 'light' | 'dark';
export interface Toast { id: number; kind: 'success' | 'error' | 'info'; message: string }

interface UiState {
  theme: Theme;
  sidebarOpen: boolean;
  toasts: Toast[];
  setTheme: (t: Theme) => void;
  toggleTheme: () => void;
  setSidebarOpen: (open: boolean) => void;
  toast: (kind: Toast['kind'], message: string) => void;
  dismiss: (id: number) => void;
}

const applyTheme = (t: Theme) => {
  document.documentElement.classList.toggle('dark', t === 'dark');
};

let toastId = 0;

export const useUiStore = create<UiState>((set, get) => ({
  theme: 'light',
  sidebarOpen: false,
  toasts: [],
  setTheme: (theme) => { applyTheme(theme); set({ theme }); },
  toggleTheme: () => { get().setTheme(get().theme === 'dark' ? 'light' : 'dark'); },
  setSidebarOpen: (sidebarOpen) => { set({ sidebarOpen }); },
  toast: (kind, message) => {
    const id = ++toastId;
    set((s) => ({ toasts: [...s.toasts, { id, kind, message }] }));
    window.setTimeout(() => { get().dismiss(id); }, 5_000);
  },
  dismiss: (id) => { set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })); },
}));
