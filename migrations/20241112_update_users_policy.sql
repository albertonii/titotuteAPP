-- Ajustar políticas para permitir que admins autenticados inserten usuarios desde el cliente

DROP POLICY IF EXISTS "Solo admin inserta usuarios manualmente" ON public.users;

CREATE POLICY "Admins pueden insertar usuarios"
  ON public.users
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL AND (
      public.jwt_role() = 'admin' OR
      EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid() AND u.role = 'admin'
      )
    )
  );

-- Permitir al service_role (Edge Functions / sync) insertar sin restricciones
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'users'
      AND policyname = 'Service role gestiona usuarios'
  ) THEN
    CREATE POLICY "Service role gestiona usuarios"
      ON public.users
      FOR INSERT
      WITH CHECK (auth.role() = 'service_role');
  END IF;
END
$$;
