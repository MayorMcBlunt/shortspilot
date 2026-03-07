-- Migration 004: Allow users to delete their own queue items
-- Run in: Supabase Dashboard -> SQL Editor

drop policy if exists "Users can delete their own queue items" on public.content_queue;

create policy "Users can delete their own queue items"
  on public.content_queue for delete
  using (auth.uid() = user_id);
