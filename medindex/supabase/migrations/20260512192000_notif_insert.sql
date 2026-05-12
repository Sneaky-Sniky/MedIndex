create policy notif_insert_own on public.notification_preferences for insert to authenticated with check (auth.uid() = user_id);
