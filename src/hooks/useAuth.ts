import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
export function useAuth() {
  const store = useAuthStore();
  useEffect(() => {
    if (store.status === 'loading') void store.init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return store;
}
