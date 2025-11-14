-- Tablas para almacenar la planificación detallada de ejercicios y warmups por sesión

-- Tabla de warmups planificados por sesión
CREATE TABLE IF NOT EXISTS public.session_warmups (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  description text NOT NULL,
  resource text,
  order_index integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS session_warmups_session_idx ON public.session_warmups (session_id);
CREATE INDEX IF NOT EXISTS session_warmups_order_idx ON public.session_warmups (order_index);

DROP TRIGGER IF EXISTS trg_session_warmups_updated ON public.session_warmups;
CREATE TRIGGER trg_session_warmups_updated
  BEFORE UPDATE ON public.session_warmups
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Tabla de ejercicios planificados por sesión
CREATE TABLE IF NOT EXISTS public.session_exercises (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id uuid NOT NULL REFERENCES public.sessions (id) ON DELETE CASCADE,
  exercise_name text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  rest text, -- Descanso general
  rest_by_microcycle jsonb, -- Descanso específico por microciclo: {"1º": "60\" a 90\"", "2º": "90\""}
  video_resource text, -- Link a video del ejercicio
  general_instructions text, -- Instrucciones generales (ej: "TUT EN TODO MOMENTO CONTROLADO")
  warnings text, -- Advertencias importantes (ej: "OJO A LAS SERIES SPEED CHANGES")
  notes_json jsonb, -- Para almacenar TODAS las notas complejas del ejercicio (array de arrays)
  header_json jsonb, -- Para almacenar el header con información de series por microciclo
  exercise_variations jsonb, -- Variaciones del ejercicio por microciclo (ej: {"1º": "PRENSA", "2º": "UNIL MANC"})
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS session_exercises_session_idx ON public.session_exercises (session_id);
CREATE INDEX IF NOT EXISTS session_exercises_order_idx ON public.session_exercises (order_index);
CREATE INDEX IF NOT EXISTS session_exercises_name_idx ON public.session_exercises (exercise_name);

DROP TRIGGER IF EXISTS trg_session_exercises_updated ON public.session_exercises;
CREATE TRIGGER trg_session_exercises_updated
  BEFORE UPDATE ON public.session_exercises
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Tabla de series planificadas por ejercicio
CREATE TABLE IF NOT EXISTS public.exercise_series (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_exercise_id uuid NOT NULL REFERENCES public.session_exercises (id) ON DELETE CASCADE,
  series_number integer NOT NULL, -- 1, 2, 3, etc.
  series_label text, -- Etiqueta completa de la serie (ej: "1ª Serie (60kg)", "2ª Serie")
  microcycle_name text, -- Para identificar a qué microciclo pertenece esta serie
  load text, -- Carga planificada
  reps text, -- Repeticiones planificadas (puede incluir "MAX", "10 a 12", etc.)
  rir text, -- RIR planificada (puede incluir "RIR 1-0", "RIR 1-2", etc.)
  notes text, -- Notas específicas de la serie
  rest text, -- Descanso específico de la serie
  special_instructions text, -- Instrucciones especiales (ej: "SPEED CHANGES", "R.P20\"", "MAX+R.P 20\"")
  exercise_variation text, -- Variación específica para esta serie (ej: "PRENSA", "UNIL MANC")
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS exercise_series_exercise_idx ON public.exercise_series (session_exercise_id);
CREATE INDEX IF NOT EXISTS exercise_series_number_idx ON public.exercise_series (series_number);
CREATE INDEX IF NOT EXISTS exercise_series_microcycle_idx ON public.exercise_series (microcycle_name);

DROP TRIGGER IF EXISTS trg_exercise_series_updated ON public.exercise_series;
CREATE TRIGGER trg_exercise_series_updated
  BEFORE UPDATE ON public.exercise_series
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Habilitar RLS
ALTER TABLE public.session_warmups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_series ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para session_warmups
DROP POLICY IF EXISTS "Warmups visibles para staff y dueño de sesión" ON public.session_warmups;
CREATE POLICY "Warmups visibles para staff y dueño de sesión"
  ON public.session_warmups
  FOR SELECT
  USING (
    public.jwt_role() IN ('admin', 'trainer', 'nutritionist')
    OR EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_warmups.session_id
      AND s.trainer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Warmups gestionados por staff" ON public.session_warmups;
CREATE POLICY "Warmups gestionados por staff"
  ON public.session_warmups
  FOR ALL
  USING (public.jwt_role() IN ('admin', 'trainer') OR auth.role() = 'service_role')
  WITH CHECK (public.jwt_role() IN ('admin', 'trainer') OR auth.role() = 'service_role');

-- Políticas RLS para session_exercises
DROP POLICY IF EXISTS "Ejercicios visibles para staff y dueño de sesión" ON public.session_exercises;
CREATE POLICY "Ejercicios visibles para staff y dueño de sesión"
  ON public.session_exercises
  FOR SELECT
  USING (
    public.jwt_role() IN ('admin', 'trainer', 'nutritionist')
    OR EXISTS (
      SELECT 1 FROM public.sessions s
      WHERE s.id = session_exercises.session_id
      AND s.trainer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Ejercicios gestionados por staff" ON public.session_exercises;
CREATE POLICY "Ejercicios gestionados por staff"
  ON public.session_exercises
  FOR ALL
  USING (public.jwt_role() IN ('admin', 'trainer') OR auth.role() = 'service_role')
  WITH CHECK (public.jwt_role() IN ('admin', 'trainer') OR auth.role() = 'service_role');

-- Políticas RLS para exercise_series
DROP POLICY IF EXISTS "Series visibles para staff y dueño de sesión" ON public.exercise_series;
CREATE POLICY "Series visibles para staff y dueño de sesión"
  ON public.exercise_series
  FOR SELECT
  USING (
    public.jwt_role() IN ('admin', 'trainer', 'nutritionist')
    OR EXISTS (
      SELECT 1 FROM public.session_exercises se
      JOIN public.sessions s ON s.id = se.session_id
      WHERE se.id = exercise_series.session_exercise_id
      AND s.trainer_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Series gestionadas por staff" ON public.exercise_series;
CREATE POLICY "Series gestionadas por staff"
  ON public.exercise_series
  FOR ALL
  USING (public.jwt_role() IN ('admin', 'trainer') OR auth.role() = 'service_role')
  WITH CHECK (public.jwt_role() IN ('admin', 'trainer') OR auth.role() = 'service_role');

