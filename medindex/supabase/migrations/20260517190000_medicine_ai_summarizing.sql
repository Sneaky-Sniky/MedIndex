alter table public.medicines
  add column if not exists ai_summarizing_at timestamptz;

create or replace function public.medicines_clear_ai_summary_on_change()
returns trigger
language plpgsql
as $$
begin
  if (
    old.den_comerciala is distinct from new.den_comerciala
    or old.dci is distinct from new.dci
    or old.forma_farmaceutica is distinct from new.forma_farmaceutica
    or old.concentratie is distinct from new.concentratie
    or old.cod_atc is distinct from new.cod_atc
    or old.act_terapeutic is distinct from new.act_terapeutic
    or old.prescriptie is distinct from new.prescriptie
    or old.ambalaj is distinct from new.ambalaj
    or old.volum_ambalaj is distinct from new.volum_ambalaj
    or old.valabilitate_ambalaj is distinct from new.valabilitate_ambalaj
    or old.firma_tara_producator is distinct from new.firma_tara_producator
    or old.firma_tara_detinator is distinct from new.firma_tara_detinator
    or old.numar_inregistrare is distinct from new.numar_inregistrare
    or old.link_rcp is distinct from new.link_rcp
    or old.link_prospect is distinct from new.link_prospect
    or old.link_ambalaj is distinct from new.link_ambalaj
    or old.tip_inregistrare is distinct from new.tip_inregistrare
    or old.anm_payload is distinct from new.anm_payload
    or old.slug is distinct from new.slug
  ) then
    new.ai_summary_ro := null;
    new.ai_summary_hu := null;
    new.ai_summarizing_at := null;
  end if;
  return new;
end;
$$;

create or replace function public.invalidate_medicine_ai_summaries()
returns trigger
language plpgsql
as $$
declare
  target_cim text;
begin
  target_cim := coalesce(new.medicine_cim, old.medicine_cim);
  update public.medicines
  set
    ai_summary_ro = null,
    ai_summary_hu = null,
    ai_summarizing_at = null
  where cim = target_cim
    and (
      ai_summary_ro is not null
      or ai_summary_hu is not null
      or ai_summarizing_at is not null
    );
  return coalesce(new, old);
end;
$$;

create or replace function public.claim_medicine_ai_summary(p_cim text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rows_updated int;
begin
  update public.medicines
  set ai_summarizing_at = now()
  where cim = p_cim
    and ai_summary_ro is null
    and ai_summary_hu is null
    and (
      ai_summarizing_at is null
      or ai_summarizing_at < now() - interval '30 minutes'
    );
  get diagnostics rows_updated = row_count;
  return rows_updated > 0;
end;
$$;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.medicines;
  end if;
exception
  when duplicate_object then null;
end;
$$;
