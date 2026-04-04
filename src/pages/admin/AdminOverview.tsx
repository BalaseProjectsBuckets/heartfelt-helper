import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Users, CheckCircle2, ListTodo, RefreshCw, TrendingUp, AlertTriangle } from 'lucide-react';
import { motion } from 'framer-motion';
import { Progress } from '@/components/ui/progress';

interface Stats {
  totalUsers: number;
  totalTasks: number;
  completedTasks: number;
  pendingTasks: number;
  rescheduledTasks: number;
  activeToday: number;
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-xl p-5 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value.toLocaleString()}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </motion.div>
  );
}

export default function AdminOverview() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [{ count: totalUsers }, { data: tasks }] = await Promise.all([
        supabase.from('profiles').select('*', { count: 'exact', head: true }),
        supabase.from('tasks').select('status, scheduled_date'),
      ]);

      const today = new Date().toISOString().split('T')[0];
      setStats({
        totalUsers: totalUsers ?? 0,
        totalTasks: tasks?.length ?? 0,
        completedTasks:   tasks?.filter(t => t.status === 'completed').length ?? 0,
        pendingTasks:     tasks?.filter(t => t.status === 'pending').length ?? 0,
        rescheduledTasks: tasks?.filter(t => t.status === 'rescheduled').length ?? 0,
        activeToday:      tasks?.filter(t => t.scheduled_date === today).length ?? 0,
      });
      setLoading(false);
    })();
  }, []);

  const completionRate = stats && stats.totalTasks > 0
    ? Math.round((stats.completedTasks / stats.totalTasks) * 100)
    : 0;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-sm text-muted-foreground">Platform-wide statistics</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : stats && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <StatCard icon={Users}       label="Total Users"       value={stats.totalUsers}       color="bg-blue-500" />
            <StatCard icon={ListTodo}    label="Total Tasks"       value={stats.totalTasks}       color="bg-purple-500" />
            <StatCard icon={CheckCircle2} label="Completed Tasks"  value={stats.completedTasks}   color="bg-green-500" />
            <StatCard icon={AlertTriangle} label="Pending Tasks"   value={stats.pendingTasks}     color="bg-yellow-500" />
            <StatCard icon={RefreshCw}   label="Rescheduled"       value={stats.rescheduledTasks} color="bg-orange-500" />
            <StatCard icon={TrendingUp}  label="Tasks Today"       value={stats.activeToday}      color="bg-pink-500" />
          </div>

          <div className="glass-card rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold">Platform Completion Rate</span>
              <span className="text-sm font-mono text-primary">{completionRate}%</span>
            </div>
            <Progress value={completionRate} className="h-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {stats.completedTasks} of {stats.totalTasks} tasks completed across all users
            </p>
          </div>
        </>
      )}
    </div>
  );
}
