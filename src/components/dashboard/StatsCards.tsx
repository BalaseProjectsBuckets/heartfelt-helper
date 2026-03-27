import { motion } from 'framer-motion';
import { CheckCircle2, Clock, ListTodo, RefreshCw } from 'lucide-react';
import { useTaskStats } from '@/hooks/useTasks';

const stats = [
  { key: 'total', label: 'Total Tasks', icon: ListTodo, color: 'text-primary' },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, color: 'text-success' },
  { key: 'inProgress', label: 'In Progress', icon: Clock, color: 'text-warning' },
  { key: 'rescheduled', label: 'Rescheduled', icon: RefreshCw, color: 'text-info' },
] as const;

export function StatsCards() {
  const { data } = useTaskStats();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.key}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.1 }}
          className="glass-card rounded-xl p-5"
        >
          <div className="flex items-center justify-between mb-3">
            <stat.icon className={`w-5 h-5 ${stat.color}`} />
            <span className="text-2xl font-bold font-mono">{data?.[stat.key] ?? 0}</span>
          </div>
          <p className="text-sm text-muted-foreground">{stat.label}</p>
          {stat.key === 'completed' && data && (
            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-success rounded-full transition-all" style={{ width: `${data.completionRate}%` }} />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}
