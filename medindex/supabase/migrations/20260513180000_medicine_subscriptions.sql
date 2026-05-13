-- Per-medicine follow list (used with global notification preferences)

create table public.medicine_subscriptions (
  user_id uuid not null references public.profiles (id) on delete cascade,
  medicine_cim text not null references public.medicines (cim) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, medicine_cim)
);

create index medicine_subscriptions_user_idx on public.medicine_subscriptions (user_id);

alter table public.medicine_subscriptions enable row level security;

create policy medicine_subscriptions_select_own
  on public.medicine_subscriptions for select to authenticated
  using (auth.uid() = user_id);

create policy medicine_subscriptions_insert_own
  on public.medicine_subscriptions for insert to authenticated
  with check (auth.uid() = user_id);

create policy medicine_subscriptions_delete_own
  on public.medicine_subscriptions for delete to authenticated
  using (auth.uid() = user_id);
