-- Tabla para asignar planificaciones (macrociclos) a usuarios
CREATE TABLE IF NOT EXISTS public.planning_assignments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES public.users (id) ON DELETE CASCADE,
  macrocycle_id uuid NOT NULL REFERENCES public.macrocycles (id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT false,
  assigned_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  assigned_by uuid REFERENCES public.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  UNIQUE (user_id, macrocycle_id)
);

CREATE INDEX IF NOT EXISTS planning_assignments_user_idx ON public.planning_assignments (user_id);
CREATE INDEX IF NOT EXISTS planning_assignments_macrocycle_idx ON public.planning_assignments (macrocycle_id);
CREATE INDEX IF NOT EXISTS planning_assignments_active_idx ON public.planning_assignments (is_active) WHERE is_active = true;

CREATE TRIGGER trg_planning_assignments_updated
  BEFORE UPDATE ON public.planning_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- Habilitar RLS
ALTER TABLE public.planning_assignments ENABLE ROW LEVEL SECURITY;

-- Política: Staff puede ver todas las asignaciones
CREATE POLICY "Asignaciones visibles para staff"
  ON public.planning_assignments
  FOR SELECT
  USING (
    public.jwt_role() IN ('admin', 'trainer', 'nutritionist')
    OR user_id = auth.uid()
  );

-- Política: Staff puede gestionar asignaciones
CREATE POLICY "Asignaciones gestionadas por staff"
  ON public.planning_assignments
  FOR ALL
  USING (public.jwt_role() IN ('admin', 'trainer'))
  WITH CHECK (public.jwt_role() IN ('admin', 'trainer'));

