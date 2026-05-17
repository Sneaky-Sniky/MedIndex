alter table public.forum_threads
  add column if not exists opening_ai_scheduled_at timestamptz;

create or replace function public.claim_forum_opening_ai_reply(p_thread_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  rows_updated int;
begin
  update public.forum_threads
  set opening_ai_scheduled_at = now()
  where id = p_thread_id
    and opening_ai_scheduled_at is null
    and not exists (
      select 1
      from public.forum_posts fp
      where fp.thread_id = p_thread_id
    );
  get diagnostics rows_updated = row_count;
  return rows_updated > 0;
end;
$$;
