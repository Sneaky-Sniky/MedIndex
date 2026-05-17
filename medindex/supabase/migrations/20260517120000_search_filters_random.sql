drop function if exists public.search_medicines(text, int);

create function public.random_medicines(lim int default 24)
returns table (
  cim text,
  den_comerciala text,
  dci text,
  forma_farmaceutica text,
  concentratie text,
  cod_atc text,
  slug text
)
language sql
volatile
set search_path = public
as $$
  select
    m.cim,
    m.den_comerciala,
    m.dci,
    m.forma_farmaceutica,
    m.concentratie,
    m.cod_atc,
    m.slug
  from public.medicines m
  order by random()
  limit greatest(1, least(coalesce(lim, 24), 50));
$$;

create function public.search_medicines(
  q text default '',
  lim int default 40,
  atc_prefix text default null,
  forma_filter text default null,
  rx_filter text default null,
  sort_by text default 'relevance'
)
returns table (
  cim text,
  den_comerciala text,
  dci text,
  forma_farmaceutica text,
  concentratie text,
  cod_atc text,
  slug text
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
    m.slug
  from public.medicines m
  where
    (
      trim(coalesce(q, '')) = ''
      or m.search_vector @@ plainto_tsquery('simple', trim(q))
      or m.den_comerciala ilike '%' || trim(q) || '%'
      or m.dci ilike '%' || trim(q) || '%'
      or m.cim ilike '%' || trim(q) || '%'
      or m.cod_atc ilike '%' || trim(q) || '%'
    )
    and (
      atc_prefix is null
      or trim(atc_prefix) = ''
      or m.cod_atc ilike trim(atc_prefix) || '%'
    )
    and (
      forma_filter is null
      or trim(forma_filter) = ''
      or m.forma_farmaceutica ilike '%' || trim(forma_filter) || '%'
    )
    and (
      rx_filter is null
      or trim(rx_filter) = ''
      or (
        rx_filter = 'otc'
        and coalesce(m.prescriptie, '') ilike '%fara prescriptie%'
      )
      or (
        rx_filter = 'rx'
        and coalesce(m.prescriptie, '') ilike '%reteta%'
        and coalesce(m.prescriptie, '') not ilike '%fara prescriptie%'
      )
    )
  order by
    case when coalesce(sort_by, 'relevance') = 'name' then m.den_comerciala end asc,
    case when sort_by = 'atc' then m.cod_atc end asc nulls last,
    case
      when coalesce(sort_by, 'relevance') = 'relevance' and trim(coalesce(q, '')) <> '' then
        ts_rank(m.search_vector, plainto_tsquery('simple', trim(q)))
    end desc nulls last,
    m.den_comerciala asc
  limit greatest(1, least(coalesce(lim, 40), 100));
$$;

grant execute on function public.random_medicines(int) to anon, authenticated;
grant execute on function public.search_medicines(text, int, text, text, text, text) to anon, authenticated;
