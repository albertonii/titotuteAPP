create table if not exists public.exercise_logs (
  id uuid primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  training_sheet text not null,
  exercise_name text not null,
  microcycle text,
  load text,
  reps text,
  rir text,
  notes text,
  performed_at timestamptz not null,
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists exercise_logs_user_idx on public.exercise_logs (user_id);
create index if not exists exercise_logs_training_idx on public.exercise_logs (training_sheet);
create index if not exists exercise_logs_exercise_idx on public.exercise_logs (exercise_name);
create index if not exists exercise_logs_performed_idx on public.exercise_logs (performed_at desc);

alter table public.exercise_logs enable row level security;

create policy if not exists "exercise_logs_select"
  on public.exercise_logs
  for select
  using (
    auth.uid() = user_id
    or public.jwt_role() in ('admin', 'trainer', 'nutritionist')
    or exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.role in ('admin', 'trainer', 'nutritionist')
    )
  );

create policy if not exists "exercise_logs_insert"
  on public.exercise_logs
  for insert
  with check (
    auth.uid() = user_id
    or public.jwt_role() in ('admin', 'trainer')
    or exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.role in ('admin', 'trainer')
    )
  );

create policy if not exists "exercise_logs_update"
  on public.exercise_logs
  for update
  using (
    auth.uid() = user_id
    or public.jwt_role() in ('admin', 'trainer')
    or exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.role in ('admin', 'trainer')
    )
  )
  with check (
    auth.uid() = user_id
    or public.jwt_role() in ('admin', 'trainer')
    or exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.role in ('admin', 'trainer')
    )
  );

create policy if not exists "exercise_logs_delete"
  on public.exercise_logs
  for delete
  using (
    auth.uid() = user_id
    or public.jwt_role() in ('admin', 'trainer')
    or exists (
      select 1 from public.users u
      where u.id = auth.uid()
        and u.role in ('admin', 'trainer')
    )
  );
