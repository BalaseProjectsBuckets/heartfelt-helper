-- ─────────────────────────────────────────────────────────────
-- Helper: is a given date a valid reschedule slot?
-- Valid slots: every Sunday, 2nd Saturday, 4th Saturday of month
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_reschedule_slot(d DATE)
RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  dow       INT := EXTRACT(DOW FROM d);   -- 0=Sun, 6=Sat
  week_num  INT := CEIL(EXTRACT(DAY FROM d) / 7.0);
BEGIN
  -- Every Sunday
  IF dow = 0 THEN RETURN TRUE; END IF;
  -- 2nd Saturday or 4th Saturday
  IF dow = 6 AND week_num IN (2, 4) THEN RETURN TRUE; END IF;
  RETURN FALSE;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Helper: given a start date, return the next N reschedule slots
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_next_reschedule_slots(from_date DATE, need INT)
RETURNS DATE[]
LANGUAGE plpgsql
AS $$
DECLARE
  slots DATE[] := '{}';
  d     DATE   := from_date + 1;
BEGIN
  WHILE array_length(slots, 1) IS NULL OR array_length(slots, 1) < need LOOP
    IF public.is_reschedule_slot(d) THEN
      slots := slots || d;
    END IF;
    d := d + 1;
    IF d > from_date + 90 THEN EXIT; END IF; -- safety cap
  END LOOP;
  RETURN slots;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- Main: auto-reschedule tasks overdue by 48h
-- Distributes tasks across upcoming slots (not all on one day)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.auto_reschedule_overdue_tasks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  overdue_task  RECORD;
  slots         DATE[];
  slot_index    INT := 1;
  affected      INT := 0;
  overdue_count INT := 0;
BEGIN
  -- Count how many tasks need rescheduling
  SELECT COUNT(*) INTO overdue_count
  FROM public.tasks
  WHERE status IN ('pending', 'in_progress')
    AND scheduled_date <= CURRENT_DATE - INTERVAL '2 days'
    AND (rescheduled_to IS NULL OR rescheduled_to < CURRENT_DATE);

  IF overdue_count = 0 THEN RETURN 0; END IF;

  -- Get enough future slots to distribute all overdue tasks
  -- Each slot can hold multiple tasks, but we spread across slots
  -- Get slots = ceil(overdue_count / 5) to allow ~5 tasks per slot
  slots := public.get_next_reschedule_slots(CURRENT_DATE, GREATEST(1, CEIL(overdue_count::FLOAT / 5)::INT));

  IF array_length(slots, 1) IS NULL THEN RETURN 0; END IF;

  -- Assign each overdue task to a slot in round-robin fashion
  FOR overdue_task IN
    SELECT id
    FROM public.tasks
    WHERE status IN ('pending', 'in_progress')
      AND scheduled_date <= CURRENT_DATE - INTERVAL '2 days'
      AND (rescheduled_to IS NULL OR rescheduled_to < CURRENT_DATE)
    ORDER BY scheduled_date ASC, priority DESC
  LOOP
    UPDATE public.tasks
    SET
      status         = 'rescheduled',
      rescheduled_to = slots[slot_index],
      notes          = COALESCE(notes || E'\n', '') ||
                       '[Auto-rescheduled on ' || CURRENT_DATE::TEXT ||
                       ': not completed within 48h → moved to extra study slot ' ||
                       slots[slot_index]::TEXT || ']',
      updated_at     = now()
    WHERE id = overdue_task.id;

    affected   := affected + 1;
    slot_index := slot_index + 1;
    -- Cycle back through slots if we run out
    IF slot_index > array_length(slots, 1) THEN
      slot_index := 1;
    END IF;
  END LOOP;

  RETURN affected;
END;
$$;

-- ─────────────────────────────────────────────────────────────
-- pg_cron: run every hour
-- (pg_cron must be enabled in Supabase Dashboard → Database → Extensions)
-- ─────────────────────────────────────────────────────────────
SELECT cron.unschedule('auto-reschedule-overdue-tasks') WHERE EXISTS (
  SELECT 1 FROM cron.job WHERE jobname = 'auto-reschedule-overdue-tasks'
);

SELECT cron.schedule(
  'auto-reschedule-overdue-tasks',
  '0 * * * *',
  'SELECT public.auto_reschedule_overdue_tasks()'
);
