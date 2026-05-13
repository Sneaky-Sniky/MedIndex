-- PostgREST JSON can fail when RPC returns SETOF a row type that includes tsvector.
-- PG does not allow changing return type with CREATE OR REPLACE → drop then create.

drop function if exists public.search_medicines(text, int);

create function public.search_medicines(
  q text,
  lim int default 20
)
returns table (
  cim text,
  den_comerciala text,
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
  anm_payload jsonb,
  slug text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select
    m.cim,
    m.den_comerciala,
    m.dci,
    m.forma_farmaceutica,
    m.concentratie,
    m.cod_atc,
    m.act_terapeutic,
    m.prescriptie,
    m.ambalaj,
    m.volum_ambalaj,
    m.valabilitate_ambalaj,
    m.firma_tara_producator,
    m.firma_tara_detinator,
    m.numar_inregistrare,
    m.link_rcp,
    m.link_prospect,
    m.link_ambalaj,
    m.tip_inregistrare,
    m.anm_payload,
    m.slug,
    m.created_at,
    m.updated_at
  from public.medicines m
  where
    q is null
    or trim(q) = ''
    or m.search_vector @@ plainto_tsquery('simple', trim(q))
    or m.den_comerciala ilike '%' || trim(q) || '%'
    or m.dci ilike '%' || trim(q) || '%'
    or m.cim ilike '%' || trim(q) || '%'
    or m.cod_atc ilike '%' || trim(q) || '%'
  order by
    case
      when q is not null and trim(q) <> '' then
        ts_rank(m.search_vector, plainto_tsquery('simple', trim(q)))
      else 0
    end desc,
    m.den_comerciala asc
  limit greatest(1, least(coalesce(lim, 20), 100));
$$;

grant execute on function public.search_medicines(text, int) to anon, authenticated;
