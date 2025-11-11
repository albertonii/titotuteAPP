-- -----------------------------------------------------------------------------
-- Tito & Tute Training – Esquema base Supabase
-- -----------------------------------------------------------------------------

-- Extensiones necesarias
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;
create extension if not exists citext;

-- Enum para roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    WHERE t.typname = 'user_role'
      AND t.typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.user_role AS ENUM (
      'trainer',
      'athlete',
      'nutritionist',
      'admin'
    );
  END IF;
END
$$;

-- Función para refrescar updated_at automáticamente
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

-- Tabla users (perfil extendido del usuario Auth)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL,
  role public.user_role NOT NULL,
  email citext UNIQUE NOT NULL,
  height numeric,
  birthdate date,
  goal text,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS users_role_idx ON public.users (role);
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users (email);

CREATE TRIGGER trg_users_updated
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Tabla mesocycles
CREATE TABLE IF NOT EXISTS public.mesocycles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  phase text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE TRIGGER trg_mesocycles_updated
  BEFORE UPDATE ON public.mesocycles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Tabla sessions
CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mesocycle_id uuid REFERENCES public.mesocycles (id) ON DELETE SET NULL,
  trainer_id uuid REFERENCES public.users (id) ON DELETE SET NULL,
  date date NOT NULL,
  session_type text NOT NULL,
  microcycle text,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS sessions_trainer_idx ON public.sessions (trainer_id);
CREATE INDEX IF NOT EXISTS sessions_mesocycle_idx ON public.sessions (mesocycle_id);
CREATE INDEX IF NOT EXISTS sessions_date_idx ON public.sessions (date);

CREATE TRIGGER trg_sessions_updated
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Tabla athlete_progress
CREATE TABLE IF NOT EXISTS public.athlete_progress (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.sessions (id) ON DELETE SET NULL,
  weight_morning numeric,
  training_quality smallint NOT NULL CHECK (training_quality BETWEEN 1 AND 10),
  rpe smallint NOT NULL CHECK (rpe BETWEEN 1 AND 10),
  duration_min integer NOT NULL CHECK (duration_min >= 0),
  notes text,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS athlete_progress_user_idx ON public.athlete_progress (user_id);
CREATE INDEX IF NOT EXISTS athlete_progress_session_idx ON public.athlete_progress (session_id);

CREATE TRIGGER trg_athlete_progress_updated
  BEFORE UPDATE ON public.athlete_progress
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Tabla groups
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  trainer_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  schedule text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS groups_trainer_idx ON public.groups (trainer_id);

CREATE TRIGGER trg_groups_updated
  BEFORE UPDATE ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Tabla group_members
CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id uuid NOT NULL REFERENCES public.groups (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  since date NOT NULL DEFAULT timezone('utc', now())::date,
  UNIQUE (group_id, user_id)
);

CREATE INDEX IF NOT EXISTS group_members_group_idx ON public.group_members (group_id);
CREATE INDEX IF NOT EXISTS group_members_user_idx ON public.group_members (user_id);

-- Tabla attendance
CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('present', 'absent')),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS attendance_session_idx ON public.attendance (session_id);
CREATE INDEX IF NOT EXISTS attendance_user_idx ON public.attendance (user_id);

CREATE TRIGGER trg_attendance_updated
  BEFORE UPDATE ON public.attendance
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Tabla pending_credentials
CREATE TABLE IF NOT EXISTS public.pending_credentials (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  email citext NOT NULL,
  name text NOT NULL,
  role public.user_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  retries integer NOT NULL DEFAULT 0,
  last_error text,
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS pending_credentials_email_idx ON public.pending_credentials (email);

-- -----------------------------------------------------------------------------
-- Row Level Security (RLS)
-- -----------------------------------------------------------------------------
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mesocycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pending_credentials ENABLE ROW LEVEL SECURITY;

-- Helper para leer el rol desde el JWT
CREATE OR REPLACE FUNCTION public.jwt_role() RETURNS text
LANGUAGE sql STABLE
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    current_setting('request.jwt.claims', true)::jsonb -> 'app_metadata' ->> 'role'
  );
$$;

-- USERS
CREATE POLICY "Usuarios visibles para staff"
  ON public.users
  FOR SELECT
  USING (
    public.jwt_role() IN ('admin', 'trainer', 'nutritionist')
    OR id = auth.uid()
  );

CREATE POLICY "Usuario puede actualizar su propio perfil"
  ON public.users
  FOR UPDATE
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "Solo admin inserta usuarios manualmente"
  ON public.users
  FOR INSERT
  WITH CHECK (public.jwt_role() = 'admin');

-- MESOCYCLES
CREATE POLICY "Mesociclos visibles para staff"
  ON public.mesocycles
  FOR SELECT
  USING (public.jwt_role() IN ('admin', 'trainer', 'nutritionist'));

CREATE POLICY "Mesociclos gestionados por admin o trainer"
  ON public.mesocycles
  FOR ALL
  USING (public.jwt_role() IN ('admin', 'trainer'))
  WITH CHECK (public.jwt_role() IN ('admin', 'trainer'));

-- SESSIONS
CREATE POLICY "Sesiones visibles para staff"
  ON public.sessions
  FOR SELECT
  USING (
    public.jwt_role() IN ('admin', 'trainer', 'nutritionist')
    OR trainer_id = auth.uid()
  );

CREATE POLICY "Sesiones gestionadas por staff"
  ON public.sessions
  FOR ALL
  USING (public.jwt_role() IN ('admin', 'trainer'))
  WITH CHECK (public.jwt_role() IN ('admin', 'trainer'));

-- ATHLETE PROGRESS
CREATE POLICY "Progreso visible para staff y dueño"
  ON public.athlete_progress
  FOR SELECT
  USING (
    public.jwt_role() IN ('admin', 'trainer', 'nutritionist')
    OR user_id = auth.uid()
  );

CREATE POLICY "Atleta puede insertar/editar su progreso"
  ON public.athlete_progress
  FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR public.jwt_role() IN ('admin', 'trainer')
  );

CREATE POLICY "Staff puede actualizar progreso de atletas"
  ON public.athlete_progress
  FOR UPDATE
  USING (
    public.jwt_role() IN ('admin', 'trainer')
    OR user_id = auth.uid()
  )
  WITH CHECK (
    public.jwt_role() IN ('admin', 'trainer')
    OR user_id = auth.uid()
  );

-- GROUPS
CREATE POLICY "Grupos visibles para staff"
  ON public.groups
  FOR SELECT
  USING (public.jwt_role() IN ('admin', 'trainer'));

CREATE POLICY "Grupos gestionados por admin o trainer"
  ON public.groups
  FOR ALL
  USING (
    public.jwt_role() IN ('admin', 'trainer')
    AND (public.jwt_role() = 'admin' OR trainer_id = auth.uid())
  )
  WITH CHECK (
    public.jwt_role() IN ('admin', 'trainer')
    AND (public.jwt_role() = 'admin' OR trainer_id = auth.uid())
  );

-- GROUP MEMBERS
CREATE POLICY "Miembros visibles para staff"
  ON public.group_members
  FOR SELECT
  USING (public.jwt_role() IN ('admin', 'trainer'));

CREATE POLICY "Gestión de miembros por staff"
  ON public.group_members
  FOR ALL
  USING (public.jwt_role() IN ('admin', 'trainer'))
  WITH CHECK (public.jwt_role() IN ('admin', 'trainer'));

-- ATTENDANCE
CREATE POLICY "Asistencia visible para staff y atleta"
  ON public.attendance
  FOR SELECT
  USING (
    public.jwt_role() IN ('admin', 'trainer')
    OR user_id = auth.uid()
  );

CREATE POLICY "Asistencia gestionada por staff"
  ON public.attendance
  FOR ALL
  USING (public.jwt_role() IN ('admin', 'trainer'))
  WITH CHECK (public.jwt_role() IN ('admin', 'trainer'));

-- PENDING CREDENTIALS
CREATE POLICY "Invitaciones solo visibles para admin"
  ON public.pending_credentials
  FOR SELECT
  USING (public.jwt_role() = 'admin');

CREATE POLICY "Invitaciones gestionadas por admin"
  ON public.pending_credentials
  FOR ALL
  USING (public.jwt_role() = 'admin')
  WITH CHECK (public.jwt_role() = 'admin');

-- -----------------------------------------------------------------------------
-- Nota: Crear luego un usuario admin inicial (ver migración adicional) para
-- iniciar sesión y gestionar el resto desde la aplicación.
-- -----------------------------------------------------------------------------
