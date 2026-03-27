import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'not_completed' | 'rescheduled';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface Task {
  id: string;
  user_id: string;
  plan_id: string | null;
  title: string;
  description: string | null;
  scheduled_date: string;
  start_time: string | null;
  end_time: string | null;
  duration_minutes: number | null;
  status: string;
  priority: string;
  category: string | null;
  tags: string[] | null;
  completion_percentage: number | null;
  rescheduled_to: string | null;
  parent_task_id: string | null;
  youtube_links: string[] | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useTasks(dateFilter?: string) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const tasksQuery = useQuery({
    queryKey: ['tasks', dateFilter],
    queryFn: async () => {
      let query = supabase.from('tasks').select('*').order('scheduled_date', { ascending: true }).order('start_time', { ascending: true });
      if (dateFilter) {
        query = query.eq('scheduled_date', dateFilter);
      }
      const { data, error } = await query;
      if (error) throw error;
      return data as Task[];
    },
    enabled: !!user,
  });

  const createTask = useMutation({
    mutationFn: async (task: Partial<Task>) => {
      const { data, error } = await supabase.from('tasks').insert({ ...task, user_id: user!.id } as any).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Task created' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const updateTask = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Task> & { id: string }) => {
      const { data, error } = await supabase.from('tasks').update(updates as any).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Task updated' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      toast({ title: 'Task deleted' });
    },
    onError: (err: any) => toast({ title: 'Error', description: err.message, variant: 'destructive' }),
  });

  return { tasks: tasksQuery.data ?? [], isLoading: tasksQuery.isLoading, createTask, updateTask, deleteTask };
}

export function useTaskStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['task-stats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tasks').select('status, completion_percentage');
      if (error) throw error;
      const total = data.length;
      const completed = data.filter(t => t.status === 'completed').length;
      const inProgress = data.filter(t => t.status === 'in_progress').length;
      const pending = data.filter(t => t.status === 'pending').length;
      const rescheduled = data.filter(t => t.status === 'rescheduled').length;
      return { total, completed, inProgress, pending, rescheduled, completionRate: total ? Math.round((completed / total) * 100) : 0 };
    },
    enabled: !!user,
  });
}
