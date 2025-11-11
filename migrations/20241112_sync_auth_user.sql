-- Sincroniza inserciones de auth.users hacia public.users

create or replace function public.sync_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text := coalesce(new.raw_user_meta_data ->> 'full_name', new.email);
  v_role public.user_role := coalesce(
    (new.raw_app_meta_data ->> 'role')::public.user_role,
    'athlete'::public.user_role
  );
begin
  insert into public.users (id, name, role, email, height, birthdate, goal, updated_at)
  values (
    new.id,
    v_name,
    v_role,
    new.email,
    null,
    null,
    null,
    timezone('utc', now())
  )
  on conflict (id) do update
    set name = excluded.name,
        role = excluded.role,
        email = excluded.email,
        updated_at = timezone('utc', now());

  return new;
end;
$$;

-- Trigger para mantener sincronización tras insert/update
create trigger sync_auth_user_trigger
  after insert or update
  on auth.users
  for each row
  execute function public.sync_auth_user();
