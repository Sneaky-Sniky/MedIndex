alter table public.medicine_documents
  add column if not exists openai_file_id text;

create index if not exists medicine_documents_openai_file_id_idx
  on public.medicine_documents (openai_file_id)
  where openai_file_id is not null;
