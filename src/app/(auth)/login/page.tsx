'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/state/auth';

export default function LoginPage() {
  const router = useRouter();
  const { signIn, status, error, user } = useAuthStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isOnline, setIsOnline] = useState<boolean>(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const updateStatus = () => setIsOnline(navigator.onLine);
    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    return () => {
      window.removeEventListener('online', updateStatus);
      window.removeEventListener('offline', updateStatus);
    };
  }, []);

  const destination = useMemo(() => {
    if (!user) return '/';
    switch (user.role) {
      case 'trainer':
        return '/coach';
      case 'nutritionist':
      case 'admin':
        return '/sync';
      default:
        return '/athlete';
    }
  }, [user]);

  useEffect(() => {
    if (status === 'authenticated' && user) {
      router.replace(destination);
    }
  }, [status, user, destination, router]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    await signIn(email.trim().toLowerCase(), password);
  };

  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur">
      <header className="flex flex-col gap-1 text-center">
        <h1 className="text-2xl font-semibold text-brand-primary">Iniciar sesión</h1>
        <p className="text-sm text-white/70">
          Acceso seguro para entrenadores, atletas y staff. Funciona offline con datos sincronizados.
        </p>
      </header>

      <div className="flex flex-col gap-1 text-xs text-white/60">
        <span className={isOnline ? 'text-brand-accent' : 'text-amber-400'}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
        <span>
          {status === 'loading'
            ? 'Validando credenciales…'
            : status === 'error'
              ? error ?? 'No se pudo iniciar sesión.'
              : 'Ingresa tus credenciales Supabase o usa datos locales.'}
        </span>
      </div>

      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        <label className="flex flex-col gap-2 text-sm">
          <span>Email</span>
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="rounded bg-white/10 p-3 text-white outline-none ring-brand-primary focus:ring"
          />
        </label>

        <label className="flex flex-col gap-2 text-sm">
          <span>Contraseña</span>
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="rounded bg-white/10 p-3 text-white outline-none ring-brand-primary focus:ring"
          />
        </label>

        <button
          type="submit"
          disabled={status === 'loading'}
          className="rounded bg-brand-primary py-3 text-sm font-semibold text-brand-dark transition hover:bg-brand-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === 'loading' ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>

      <footer className="text-center text-xs text-white/50">
        Consejo: si estás offline, asegúrate de haber iniciado sesión previamente para contar con datos locales.
      </footer>
    </section>
  );
}
