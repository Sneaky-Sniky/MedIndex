-- Helper for inserting pgvector rows from PostgREST (embedding as text literal)
create or replace function public.insert_document_chunk(
  p_medicine_cim text,
  p_document_id uuid,
  p_chunk_index int,
  p_content text,
  p_embedding text,
  p_metadata jsonb default '{}'::jsonb
) returns uuid
language plpgsql
as $$
declare
  new_id uuid;
begin
  insert into public.document_chunks (
    medicine_cim, document_id, chunk_index, content, embedding, metadata
  )
  values (
    p_medicine_cim,
    p_document_id,
    p_chunk_index,
    p_content,
    case when p_embedding is null or trim(p_embedding) = '' then null else p_embedding::vector end,
    coalesce(p_metadata, '{}'::jsonb)
  )
  returning id into new_id;
  return new_id;
end;
$$;

grant execute on function public.insert_document_chunk(text, uuid, int, text, text, jsonb) to service_role;
