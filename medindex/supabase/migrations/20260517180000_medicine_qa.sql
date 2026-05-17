-- Saved medicine Q&A (AI chat) for public archive per medicine
create table public.medicine_qa (
  id uuid primary key default gen_random_uuid(),
  medicine_cim text not null references public.medicines (cim) on delete cascade,
  question text not null,
  answer text not null,
  locale text not null check (locale in ('ro', 'hu')),
  created_at timestamptz not null default now()
);

create index medicine_qa_medicine_idx on public.medicine_qa (medicine_cim, created_at desc);

alter table public.medicine_qa enable row level security;

create policy medicine_qa_select on public.medicine_qa
  for select to anon, authenticated using (true);

create policy medicine_qa_insert on public.medicine_qa
  for insert to anon, authenticated with check (true);
