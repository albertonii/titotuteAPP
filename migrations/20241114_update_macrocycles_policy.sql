-- Actualizar política de macrociclos para permitir que trainers también puedan gestionarlos

DROP POLICY IF EXISTS "Macrocycles gestionados por admin" ON public.macrocycles;

CREATE POLICY "Macrocycles gestionados por admin o trainer"
  ON public.macrocycles
  FOR ALL
  USING (public.jwt_role() IN ('admin', 'trainer') OR auth.role() = 'service_role')
  WITH CHECK (public.jwt_role() IN ('admin', 'trainer') OR auth.role() = 'service_role');

