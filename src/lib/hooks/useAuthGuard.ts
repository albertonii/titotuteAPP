'use client';

import { useEffect } from 'react';
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

  useEffect(() => {
    if (status === 'loading') return;
    if (!user) {
      router.replace(redirectTo);
      return;
    }
    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      router.replace('/');
    }
  }, [allowedRoles, redirectTo, router, status, user]);

  return { user, status };
};
