-- Storage bucket for ANM PDF leaflets (RCP / prospect). Ingest uses bucket id "leaflets"
-- unless LEAFLETS_BUCKET env overrides the name (the bucket id in Supabase must match).

insert into storage.buckets (id, name, public)
values ('leaflets', 'leaflets', false)
on conflict (id) do nothing;
