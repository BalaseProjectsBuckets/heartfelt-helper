ALTER TABLE public.chat_conversations ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE;
