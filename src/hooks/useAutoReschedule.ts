import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';

export function useAutoReschedule() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    (async () => {
      const { data, error } = await (supabase.rpc('auto_reschedule_overdue_tasks' as any) as any);
      if (!error && data && data > 0) {
        queryClient.invalidateQueries({ queryKey: ['tasks'] });
        queryClient.invalidateQueries({ queryKey: ['task-stats'] });
      }
    })();
  }, [user]);
}
