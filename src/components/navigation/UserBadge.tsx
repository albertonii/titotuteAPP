'use client';

import { useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { useAuthStore } from '@/lib/state/auth';

export function UserBadge() {
  const router = useRouter();
  const { user, signOut, status } = useAuthStore();

  const initials = useMemo(() => {
    if (!user?.name) return 'TT';
    const parts = user.name.split(' ');
    const first = parts[0]?.[0];
    const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1];
    return `${first ?? ''}${second ?? ''}`.toUpperCase() || 'TT';
  }, [user?.name]);

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => router.push('/login')}
        className="rounded-full border border-brand-primary/50 px-3 py-1 text-xs text-brand-primary transition hover:bg-brand-primary hover:text-white"
      >
        Ingresar
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-sm font-semibold text-white shadow-sm">
        {initials}
      </div>
      <div className="flex flex-col leading-tight">
        <span className="text-xs font-medium text-slate-900">{user.name}</span>
        <span className="text-[11px] text-slate-500 capitalize">{user.role}</span>
      </div>
      <button
        type="button"
        disabled={status === 'loading'}
        onClick={() => signOut().then(() => router.push('/'))}
        className="rounded-full border border-slate-200 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-100 disabled:opacity-60"
      >
        Salir
      </button>
    </div>
  );
}
