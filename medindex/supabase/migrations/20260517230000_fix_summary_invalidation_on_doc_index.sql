-- Do not wipe cached AI summaries when only indexing metadata changes (e.g. openai_file_id).

create or replace function public.invalidate_medicine_ai_summaries()
returns trigger
language plpgsql
as $$
declare
  target_cim text;
  should_invalidate boolean := false;
begin
  target_cim := coalesce(new.medicine_cim, old.medicine_cim);

  if tg_op = 'DELETE' then
    should_invalidate := true;
  elsif tg_op = 'INSERT' then
    should_invalidate := true;
  elsif tg_op = 'UPDATE' then
    should_invalidate := (
      old.doc_type is distinct from new.doc_type
      or old.source_url is distinct from new.source_url
      or old.checksum is distinct from new.checksum
      or old.extracted_text is distinct from new.extracted_text
    );
  end if;

  if should_invalidate then
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
  end if;

  return coalesce(new, old);
end;
$$;
