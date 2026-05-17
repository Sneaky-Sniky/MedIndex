alter table public.error_reports
  add column if not exists ai_validation text,
  add column if not exists ai_validated_at timestamptz;
