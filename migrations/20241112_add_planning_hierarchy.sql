-- Amplía la jerarquía de planificación: macrociclos, mesociclos, microciclos y sesiones

-- Tabla de macrociclos
CREATE TABLE IF NOT EXISTS public.macrocycles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  season text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  goal text,
  notes text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  created_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS macrocycles_season_idx ON public.macrocycles (season);
CREATE INDEX IF NOT EXISTS macrocycles_status_idx ON public.macrocycles (status);
CREATE INDEX IF NOT EXISTS macrocycles_created_by_idx ON public.macrocycles (created_by);

CREATE TRIGGER trg_macrocycles_updated
  BEFORE UPDATE ON public.macrocycles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Extiende mesociclos con referencias a macrociclos y metadatos
ALTER TABLE public.mesocycles
  ADD COLUMN IF NOT EXISTS macrocycle_id uuid REFERENCES public.macrocycles (id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS goal text,
  ADD COLUMN IF NOT EXISTS focus text,
  ADD COLUMN IF NOT EXISTS order_index integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived'));

CREATE INDEX IF NOT EXISTS mesocycles_macrocycle_idx ON public.mesocycles (macrocycle_id);
CREATE INDEX IF NOT EXISTS mesocycles_status_idx ON public.mesocycles (status);

UPDATE public.mesocycles SET status = 'draft' WHERE status IS NULL;
UPDATE public.mesocycles SET order_index = 0 WHERE order_index IS NULL;

-- Tabla de microciclos (semanas)
CREATE TABLE IF NOT EXISTS public.microcycles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  mesocycle_id uuid NOT NULL REFERENCES public.mesocycles (id) ON DELETE CASCADE,
  name text NOT NULL,
  week_number integer NOT NULL CHECK (week_number >= 1),
  start_date date,
  end_date date,
  focus text,
  load text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS microcycles_mesocycle_idx ON public.microcycles (mesocycle_id);
CREATE INDEX IF NOT EXISTS microcycles_status_idx ON public.microcycles (status);
CREATE INDEX IF NOT EXISTS microcycles_week_idx ON public.microcycles (week_number);

CREATE TRIGGER trg_microcycles_updated
  BEFORE UPDATE ON public.microcycles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Amplía sesiones con relaciones jerárquicas y estado
ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS macrocycle_id uuid REFERENCES public.macrocycles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS microcycle_id uuid REFERENCES public.microcycles (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS order_index integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('draft', 'scheduled', 'completed', 'cancelled'));

CREATE INDEX IF NOT EXISTS sessions_microcycle_idx ON public.sessions (microcycle_id);
CREATE INDEX IF NOT EXISTS sessions_status_idx ON public.sessions (status);

UPDATE public.sessions SET status = 'scheduled' WHERE status IS NULL;
UPDATE public.sessions SET order_index = 0 WHERE order_index IS NULL;

-- Asegura RLS en nuevas tablas
ALTER TABLE public.macrocycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.microcycles ENABLE ROW LEVEL SECURITY;

-- Políticas para macrociclos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'macrocycles'
      AND policyname = 'Macrocycles visibles para staff'
  ) THEN
    CREATE POLICY "Macrocycles visibles para staff"
      ON public.macrocycles
      FOR SELECT
      USING (public.jwt_role() IN ('admin', 'trainer', 'nutritionist'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'macrocycles'
      AND policyname = 'Macrocycles gestionados por admin'
  ) THEN
    CREATE POLICY "Macrocycles gestionados por admin"
      ON public.macrocycles
      FOR ALL
      USING (public.jwt_role() = 'admin' OR auth.role() = 'service_role')
      WITH CHECK (public.jwt_role() = 'admin' OR auth.role() = 'service_role');
  END IF;
END
$$;

-- Políticas para microciclos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'microcycles'
      AND policyname = 'Microciclos visibles para staff'
  ) THEN
    CREATE POLICY "Microciclos visibles para staff"
      ON public.microcycles
      FOR SELECT
      USING (public.jwt_role() IN ('admin', 'trainer', 'nutritionist'));
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'microcycles'
      AND policyname = 'Microciclos gestionados por staff'
  ) THEN
    CREATE POLICY "Microciclos gestionados por staff"
      ON public.microcycles
      FOR ALL
      USING (public.jwt_role() IN ('admin', 'trainer') OR auth.role() = 'service_role')
      WITH CHECK (public.jwt_role() IN ('admin', 'trainer') OR auth.role() = 'service_role');
  END IF;
END
$$;

-- Permite al rol de servicio gestionar mesociclos y sesiones
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'mesocycles'
      AND policyname = 'Mesociclos service role'
  ) THEN
    CREATE POLICY "Mesociclos service role"
      ON public.mesocycles
      FOR ALL
      USING (public.jwt_role() IN ('admin', 'trainer') OR auth.role() = 'service_role')
      WITH CHECK (public.jwt_role() IN ('admin', 'trainer') OR auth.role() = 'service_role');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'sessions'
      AND policyname = 'Sesiones service role'
  ) THEN
    CREATE POLICY "Sesiones service role"
      ON public.sessions
      FOR ALL
      USING (public.jwt_role() IN ('admin', 'trainer') OR auth.role() = 'service_role')
      WITH CHECK (public.jwt_role() IN ('admin', 'trainer') OR auth.role() = 'service_role');
  END IF;
END
$$;
