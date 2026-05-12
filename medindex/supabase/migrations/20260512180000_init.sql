-- MedIndex schema: ANM medicines, documents, RAG chunks, community, notifications
-- Run on Supabase: enable pgvector in Dashboard → Database → Extensions if needed

create extension if not exists "uuid-ossp";
create extension if not exists vector;
create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------------
-- medicines (Cod CIM = primary key from ANM nomenclator)
-- ---------------------------------------------------------------------------
create table public.medicines (
  cim text primary key,
  den_comerciala text not null,
  dci text,
  forma_farmaceutica text,
  concentratie text,
  cod_atc text,
  act_terapeutic text,
  prescriptie text,
  ambalaj text,
  volum_ambalaj text,
  valabilitate_ambalaj text,
  firma_tara_producator text,
  firma_tara_detinator text,
  numar_inregistrare text,
  link_rcp text,
  link_prospect text,
  link_ambalaj text,
  tip_inregistrare text,
  anm_payload jsonb not null default '{}'::jsonb,
  slug text not null unique,
  search_vector tsvector generated always as (
    to_tsvector(
      'simple',
      coalesce(den_comerciala, '') || ' ' ||
      coalesce(dci, '') || ' ' ||
      coalesce(cod_atc, '') || ' ' ||
      coalesce(firma_tara_detinator, '')
    )
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index medicines_cod_atc_idx on public.medicines (cod_atc);
create index medicines_search_idx on public.medicines using gin (search_vector);
create index medicines_den_trgm on public.medicines using gin (den_comerciala gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- medicine_documents (RCP / prospect PDFs)
-- ---------------------------------------------------------------------------
create table public.medicine_documents (
  id uuid primary key default gen_random_uuid(),
  medicine_cim text not null references public.medicines (cim) on delete cascade,
  doc_type text not null check (doc_type in ('rcp', 'prospect', 'ambalaj', 'other')),
  source_url text,
  storage_path text,
  extracted_text text,
  checksum text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (medicine_cim, doc_type)
);

create index medicine_documents_cim_idx on public.medicine_documents (medicine_cim);

-- ---------------------------------------------------------------------------
-- document_chunks (RAG)
-- ---------------------------------------------------------------------------
create table public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  medicine_cim text not null references public.medicines (cim) on delete cascade,
  document_id uuid references public.medicine_documents (id) on delete set null,
  chunk_index int not null default 0,
  content text not null,
  embedding vector(1536),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index document_chunks_cim_idx on public.document_chunks (medicine_cim);
create index document_chunks_embedding_idx on public.document_chunks
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ---------------------------------------------------------------------------
-- ingest cursor (paged ANM sync)
-- ---------------------------------------------------------------------------
create table public.ingest_state (
  job_key text primary key,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- profiles (1:1 auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- reviews
-- ---------------------------------------------------------------------------
create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  medicine_cim text not null references public.medicines (cim) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  rating int not null check (rating >= 1 and rating <= 5),
  body text not null default '',
  created_at timestamptz not null default now()
);

create index reviews_medicine_idx on public.reviews (medicine_cim);

-- ---------------------------------------------------------------------------
-- error_reports
-- ---------------------------------------------------------------------------
create table public.error_reports (
  id uuid primary key default gen_random_uuid(),
  medicine_cim text references public.medicines (cim) on delete set null,
  user_id uuid references public.profiles (id) on delete set null,
  message text not null,
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- forum
-- ---------------------------------------------------------------------------
create table public.forum_threads (
  id uuid primary key default gen_random_uuid(),
  medicine_cim text references public.medicines (cim) on delete set null,
  title text not null,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.forum_posts (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.forum_threads (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  body text not null,
  is_ai_draft boolean not null default false,
  created_at timestamptz not null default now()
);

create index forum_posts_thread_idx on public.forum_posts (thread_id);

create table public.forum_post_votes (
  post_id uuid not null references public.forum_posts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  primary key (post_id, user_id)
);

-- ---------------------------------------------------------------------------
-- notification preferences
-- ---------------------------------------------------------------------------
create table public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  email_recalls boolean not null default true,
  push_recalls boolean not null default false,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger medicines_updated_at
  before update on public.medicines
  for each row execute function public.set_updated_at;

create trigger medicine_documents_updated_at
  before update on public.medicine_documents
  for each row execute function public.set_updated_at;

-- ---------------------------------------------------------------------------
-- auth: new user → profile
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'user'
  );
  insert into public.notification_preferences (user_id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user

-- ---------------------------------------------------------------------------
-- hybrid search RPC
-- ---------------------------------------------------------------------------
create or replace function public.search_medicines(
  q text,
  lim int default 20
)
returns setof public.medicines
language sql
stable
as $$
  select *
  from public.medicines m
  where
    q is null or trim(q) = '' or
    m.search_vector @@ plainto_tsquery('simple', q) or
    m.den_comerciala ilike '%' || q || '%' or
    m.dci ilike '%' || q || '%' or
    m.cim ilike '%' || q || '%'
  order by
    case when q is not null and trim(q) <> '' then
      ts_rank(m.search_vector, plainto_tsquery('simple', q))
    else 0 end desc,
    m.den_comerciala asc
  limit greatest(1, least(lim, 100));
$$;

create or replace function public.match_document_chunks(
  query_embedding vector(1536),
  match_count int default 8,
  filter_medicine_cim text default null
)
returns table (
  id uuid,
  medicine_cim text,
  content text,
  similarity float
)
language sql
stable
as $$
  select
    dc.id,
    dc.medicine_cim,
    dc.content,
    1 - (dc.embedding <=> query_embedding) as similarity
  from public.document_chunks dc
  where dc.embedding is not null
    and (filter_medicine_cim is null or dc.medicine_cim = filter_medicine_cim)
  order by dc.embedding <=> query_embedding
  limit greatest(1, least(match_count, 32));
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.medicines enable row level security;
alter table public.medicine_documents enable row level security;
alter table public.document_chunks enable row level security;
alter table public.ingest_state enable row level security;
alter table public.profiles enable row level security;
alter table public.reviews enable row level security;
alter table public.error_reports enable row level security;
alter table public.forum_threads enable row level security;
alter table public.forum_posts enable row level security;
alter table public.forum_post_votes enable row level security;
alter table public.notification_preferences enable row level security;

-- Public read: medicines & documents & chunks (catalog)
create policy medicines_select_anon on public.medicines for select to anon, authenticated using (true);
create policy medicine_documents_select_anon on public.medicine_documents for select to anon, authenticated using (true);
create policy document_chunks_select_anon on public.document_chunks for select to anon, authenticated using (true);

-- ingest_state: no client access (service role bypasses RLS)
create policy ingest_state_deny on public.ingest_state for all to anon, authenticated using (false);

-- profiles
create policy profiles_select_own on public.profiles for select to authenticated using (auth.uid() = id);
create policy profiles_update_own on public.profiles for update to authenticated using (auth.uid() = id);

-- reviews: read all, insert own
create policy reviews_select on public.reviews for select to anon, authenticated using (true);
create policy reviews_insert_own on public.reviews for insert to authenticated with check (auth.uid() = user_id);
create policy reviews_update_own on public.reviews for update to authenticated using (auth.uid() = user_id);
create policy reviews_delete_own on public.reviews for delete to authenticated using (auth.uid() = user_id);

-- error_reports
create policy error_reports_insert on public.error_reports for insert to authenticated with check (auth.uid() = user_id);
create policy error_reports_select_own on public.error_reports for select to authenticated using (auth.uid() = user_id);

-- forum: read all
create policy forum_threads_select on public.forum_threads for select to anon, authenticated using (true);
create policy forum_threads_insert on public.forum_threads for insert to authenticated with check (auth.uid() = created_by);
create policy forum_posts_select on public.forum_posts for select to anon, authenticated using (true);
create policy forum_posts_insert on public.forum_posts for insert to authenticated with check (auth.uid() = user_id);
create policy forum_votes_all on public.forum_post_votes for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- notification preferences
create policy notif_select_own on public.notification_preferences for select to authenticated using (auth.uid() = user_id);
create policy notif_update_own on public.notification_preferences for update to authenticated using (auth.uid() = user_id);

-- admin (policies OR with existing)
create policy profiles_admin_select on public.profiles for select to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy error_reports_admin on public.error_reports for all to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create policy medicines_admin_update on public.medicines for update to authenticated using (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
) with check (
  exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);
