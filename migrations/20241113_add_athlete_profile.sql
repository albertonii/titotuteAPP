-- 1) Enumeración para severidad de lesiones
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'injury_severity'
  ) THEN
    CREATE TYPE public.injury_severity AS ENUM ('leve', 'moderada', 'grave', 'recuperado');
  END IF;
END
$$;

-- 2) Tabla de lesiones
CREATE TABLE IF NOT EXISTS public.injury_logs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  area text NOT NULL,
  severity public.injury_severity NOT NULL DEFAULT 'moderada',
  start_date date NOT NULL,
  end_date date,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS injury_logs_user_idx ON public.injury_logs (user_id);
CREATE INDEX IF NOT EXISTS injury_logs_severity_idx ON public.injury_logs (severity);
CREATE INDEX IF NOT EXISTS injury_logs_end_date_idx ON public.injury_logs (end_date);

CREATE TRIGGER trg_injury_logs_updated
  BEFORE UPDATE ON public.injury_logs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.injury_logs ENABLE ROW LEVEL SECURITY;

-- RLS: lectura (atleta + staff)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'injury_logs'
      AND policyname = 'Injury logs visible por usuario y staff'
  ) THEN
    CREATE POLICY "Injury logs visible por usuario y staff"
      ON public.injury_logs
      FOR SELECT
      USING (
        auth.role() = 'service_role'
        OR auth.uid() = user_id
        OR public.jwt_role() IN ('admin', 'trainer', 'nutritionist')
      );
  END IF;
END
$$;

-- RLS: inserciones (atleta + staff)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'injury_logs'
      AND policyname = 'Injury logs inserción usuaria y staff'
  ) THEN
    CREATE POLICY "Injury logs inserción usuaria y staff"
      ON public.injury_logs
      FOR INSERT
      WITH CHECK (
        auth.role() = 'service_role'
        OR auth.uid() = user_id
        OR public.jwt_role() IN ('admin', 'trainer', 'nutritionist')
      );
  END IF;
END
$$;

-- RLS: actualizaciones (atleta + staff)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'injury_logs'
      AND policyname = 'Injury logs actualización usuaria y staff'
  ) THEN
    CREATE POLICY "Injury logs actualización usuaria y staff"
      ON public.injury_logs
      FOR UPDATE
      USING (
        auth.role() = 'service_role'
        OR auth.uid() = user_id
        OR public.jwt_role() IN ('admin', 'trainer', 'nutritionist')
      )
      WITH CHECK (
        auth.role() = 'service_role'
        OR auth.uid() = user_id
        OR public.jwt_role() IN ('admin', 'trainer', 'nutritionist')
      );
  END IF;
END
$$;

-- RLS: borrados (solo staff/admin)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'injury_logs'
      AND policyname = 'Injury logs delete staff'
  ) THEN
    CREATE POLICY "Injury logs delete staff"
      ON public.injury_logs
      FOR DELETE
      USING (
        auth.role() = 'service_role'
        OR public.jwt_role() IN ('admin', 'trainer', 'nutritionist')
      );
  END IF;
END
$$;

-- 3) Tabla de perfil nutricional
CREATE TABLE IF NOT EXISTS public.nutrition_profiles (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL UNIQUE REFERENCES public.users (id) ON DELETE CASCADE,
  goal text,
  kcal_target numeric,
  protein_target numeric,
  carbs_target numeric,
  fats_target numeric,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS nutrition_profiles_user_idx ON public.nutrition_profiles (user_id);

CREATE TRIGGER trg_nutrition_profiles_updated
  BEFORE UPDATE ON public.nutrition_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.nutrition_profiles ENABLE ROW LEVEL SECURITY;

-- RLS: lectura (atleta + staff)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'nutrition_profiles'
      AND policyname = 'Nutrition profile visible por usuario y staff'
  ) THEN
    CREATE POLICY "Nutrition profile visible por usuario y staff"
      ON public.nutrition_profiles
      FOR SELECT
      USING (
        auth.role() = 'service_role'
        OR auth.uid() = user_id
        OR public.jwt_role() IN ('admin', 'trainer', 'nutritionist')
      );
  END IF;
END
$$;

-- RLS: inserción/actualización (atleta + staff)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'nutrition_profiles'
      AND policyname = 'Nutrition profiles upsert por usuario y staff'
  ) THEN
    CREATE POLICY "Nutrition profiles upsert por usuario y staff"
      ON public.nutrition_profiles
      FOR ALL
      USING (
        auth.role() = 'service_role'
        OR auth.uid() = user_id
        OR public.jwt_role() IN ('admin', 'trainer', 'nutritionist')
      )
      WITH CHECK (
        auth.role() = 'service_role'
        OR auth.uid() = user_id
        OR public.jwt_role() IN ('admin', 'trainer', 'nutritionist')
      );
  END IF;
END
$$;
