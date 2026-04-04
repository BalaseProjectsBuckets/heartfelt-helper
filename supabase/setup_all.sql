-- ============================================================
-- FULL SETUP — paste this entire file in Supabase SQL Editor
-- Replace 'your-email@example.com' at the bottom with your email
-- ============================================================

-- ── 1. Core functions ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ── 2. Plans table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  total_days INTEGER NOT NULL DEFAULT 1,
  hours_per_day INTEGER NOT NULL DEFAULT 8,
  subjects TEXT[] DEFAULT '{}',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own plans" ON public.plans;
DROP POLICY IF EXISTS "Users can create own plans" ON public.plans;
DROP POLICY IF EXISTS "Users can update own plans" ON public.plans;
DROP POLICY IF EXISTS "Users can delete own plans" ON public.plans;
CREATE POLICY "Users can view own plans"   ON public.plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own plans" ON public.plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own plans" ON public.plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own plans" ON public.plans FOR DELETE USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_plans_updated_at ON public.plans;
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ── 3. Tasks table ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
  start_time TIME,
  end_time TIME,
  duration_minutes INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'not_completed', 'rescheduled')),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  category TEXT,
  tags TEXT[] DEFAULT '{}',
  completion_percentage INTEGER DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
  rescheduled_to DATE,
  parent_task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  youtube_links TEXT[] DEFAULT '{}',
  notes TEXT,
  phase TEXT DEFAULT 'planning',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own tasks"   ON public.tasks;
DROP POLICY IF EXISTS "Users can create own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can update own tasks" ON public.tasks;
DROP POLICY IF EXISTS "Users can delete own tasks" ON public.tasks;
CREATE POLICY "Users can view own tasks"   ON public.tasks FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own tasks" ON public.tasks FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tasks" ON public.tasks FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tasks" ON public.tasks FOR DELETE USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_tasks_updated_at ON public.tasks;
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_date ON public.tasks(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON public.tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_plan_id ON public.tasks(plan_id);

-- ── 4. Profiles table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name text,
  phone text,
  avatar_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own profile"   ON public.profiles;
DROP POLICY IF EXISTS "Users can create own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"   ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, phone)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ── 5. Chat tables ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID REFERENCES public.plans(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own conversations"   ON public.chat_conversations;
DROP POLICY IF EXISTS "Users can create own conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Users can update own conversations" ON public.chat_conversations;
DROP POLICY IF EXISTS "Users can delete own conversations" ON public.chat_conversations;
CREATE POLICY "Users can view own conversations"   ON public.chat_conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own conversations" ON public.chat_conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own conversations" ON public.chat_conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own conversations" ON public.chat_conversations FOR DELETE USING (auth.uid() = user_id);
DROP TRIGGER IF EXISTS update_conversations_updated_at ON public.chat_conversations;
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON public.chat_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own messages"   ON public.chat_messages;
DROP POLICY IF EXISTS "Users can create own messages" ON public.chat_messages;
CREATE POLICY "Users can view own messages"   ON public.chat_messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own messages" ON public.chat_messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON public.chat_messages(created_at);

-- ── 6. Auto-reschedule functions ─────────────────────────────
CREATE OR REPLACE FUNCTION public.is_reschedule_slot(d DATE)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  dow      INT := EXTRACT(DOW FROM d);
  week_num INT := CEIL(EXTRACT(DAY FROM d) / 7.0);
BEGIN
  IF dow = 0 THEN RETURN TRUE; END IF;
  IF dow = 6 AND week_num IN (2, 4) THEN RETURN TRUE; END IF;
  RETURN FALSE;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_next_reschedule_slots(from_date DATE, need INT)
RETURNS DATE[] LANGUAGE plpgsql AS $$
DECLARE
  slots DATE[] := '{}';
  d     DATE   := from_date + 1;
BEGIN
  WHILE array_length(slots, 1) IS NULL OR array_length(slots, 1) < need LOOP
    IF public.is_reschedule_slot(d) THEN slots := slots || d; END IF;
    d := d + 1;
    IF d > from_date + 90 THEN EXIT; END IF;
  END LOOP;
  RETURN slots;
END;
$$;

CREATE OR REPLACE FUNCTION public.auto_reschedule_overdue_tasks()
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  overdue_task  RECORD;
  slots         DATE[];
  slot_index    INT := 1;
  affected      INT := 0;
  overdue_count INT := 0;
BEGIN
  SELECT COUNT(*) INTO overdue_count FROM public.tasks
  WHERE status IN ('pending', 'in_progress')
    AND scheduled_date <= CURRENT_DATE - INTERVAL '2 days'
    AND (rescheduled_to IS NULL OR rescheduled_to < CURRENT_DATE);
  IF overdue_count = 0 THEN RETURN 0; END IF;
  slots := public.get_next_reschedule_slots(CURRENT_DATE, GREATEST(1, CEIL(overdue_count::FLOAT / 5)::INT));
  IF array_length(slots, 1) IS NULL THEN RETURN 0; END IF;
  FOR overdue_task IN
    SELECT id FROM public.tasks
    WHERE status IN ('pending', 'in_progress')
      AND scheduled_date <= CURRENT_DATE - INTERVAL '2 days'
      AND (rescheduled_to IS NULL OR rescheduled_to < CURRENT_DATE)
    ORDER BY scheduled_date ASC, priority DESC
  LOOP
    UPDATE public.tasks SET
      status         = 'rescheduled',
      rescheduled_to = slots[slot_index],
      notes          = COALESCE(notes || E'\n', '') || '[Auto-rescheduled on ' || CURRENT_DATE::TEXT || ': not completed within 48h → moved to ' || slots[slot_index]::TEXT || ']',
      updated_at     = now()
    WHERE id = overdue_task.id;
    affected   := affected + 1;
    slot_index := slot_index + 1;
    IF slot_index > array_length(slots, 1) THEN slot_index := 1; END IF;
  END LOOP;
  RETURN affected;
END;
$$;

-- ── 7. User roles ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  role       text NOT NULL DEFAULT 'user' CHECK (role IN ('super_admin', 'admin', 'user')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view own role"    ON public.user_roles;
DROP POLICY IF EXISTS "Super admin manages roles"  ON public.user_roles;
CREATE POLICY "Users can view own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Super admin manages roles" ON public.user_roles FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role = 'super_admin'));

-- Admins read all profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin','super_admin')));

-- Admins read all tasks
DROP POLICY IF EXISTS "Admins can view all tasks" ON public.tasks;
CREATE POLICY "Admins can view all tasks" ON public.tasks FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid() AND r.role IN ('admin','super_admin')));

-- Auto-assign role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'user') ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS on_auth_user_created_role ON auth.users;
CREATE TRIGGER on_auth_user_created_role
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- Backfill existing users
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'user' FROM auth.users ON CONFLICT (user_id) DO NOTHING;

-- ── 8. Set YOUR account as super_admin ───────────────────────
-- !! REPLACE the email below with your actual login email !!
UPDATE public.user_roles
SET role = 'super_admin'
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'vigneshbalase37@gmail.com' LIMIT 1);
