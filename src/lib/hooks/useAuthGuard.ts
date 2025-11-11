'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/state/auth';
import type { UserRole } from '@/lib/db-local/db';

interface Options {
  redirectTo?: string;
  allowedRoles?: UserRole[];
}

export const useAuthGuard = ({ redirectTo = '/login', allowedRoles }: Options = {}) => {
  const router = useRouter();
  const { user, status } = useAuthStore();
  const [hydrated, setHydrated] = useState<boolean>(
    useAuthStore.persist?.hasHydrated?.() ?? false
  );

  useEffect(() => {
    const unsubHydrate = useAuthStore.persist?.onHydrate?.(() => setHydrated(false));
    const unsubFinish = useAuthStore.persist?.onFinishHydration?.(() => setHydrated(true));
    setHydrated(useAuthStore.persist?.hasHydrated?.() ?? false);
    return () => {
      unsubHydrate?.();
      unsubFinish?.();
    };
  }, []);

  useEffect(() => {
    if (!hydrated || status === 'loading') return;
    if (!user) {
      router.replace(redirectTo);
      return;
    }
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      router.replace('/');
    }
  }, [allowedRoles, hydrated, redirectTo, router, status, user]);

  return { user, status };
};
