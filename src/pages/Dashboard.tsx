import { StatsCards } from '@/components/dashboard/StatsCards';
import { useTasks, useTaskStats } from '@/hooks/useTasks';
import { TaskCard } from '@/components/tasks/TaskCard';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { useState } from 'react';
import { Task } from '@/hooks/useTasks';
import { motion } from 'framer-motion';
import { CalendarDays, Sparkles, TrendingUp, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

export default function Dashboard() {
  const today = new Date().toISOString().split('T')[0];
  const { tasks: todayTasks, isLoading } = useTasks(today);
  const { tasks: allTasks } = useTasks();
  const { data: stats } = useTaskStats();
  const [editTask, setEditTask] = useState<Task | null>(null);
  const navigate = useNavigate();

  const overdue = allTasks.filter(t => t.scheduled_date < today && t.status !== 'completed' && t.status !== 'rescheduled');
  const upcoming = allTasks.filter(t => t.scheduled_date > today && t.status !== 'completed').slice(0, 3);

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" />
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>
        <div className="flex gap-2">
          <CreateTaskDialog defaultDate={today} />
          <Button variant="outline" onClick={() => navigate('/ai-chat')}>
            <Sparkles className="w-4 h-4 mr-1" />
            AI Plan
          </Button>
        </div>
      </motion.div>

      <StatsCards />

      {/* Overall progress */}
      {stats && stats.total > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold">Overall Progress</span>
            </div>
            <span className="text-sm font-mono text-primary">{stats.completionRate}%</span>
          </div>
          <Progress value={stats.completionRate} className="h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {stats.completed} of {stats.total} tasks completed · {stats.inProgress} in progress · {stats.pending} pending
          </p>
        </motion.div>
      )}

      {/* Overdue alert */}
      {overdue.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4 border-l-4 border-l-destructive">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            <span className="text-sm font-semibold text-destructive">{overdue.length} Overdue Task{overdue.length > 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-2">
            {overdue.slice(0, 3).map(t => <TaskCard key={t.id} task={t} onEdit={setEditTask} />)}
            {overdue.length > 3 && (
              <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/tasks')}>
                View all {overdue.length} overdue tasks →
              </Button>
            )}
          </div>
        </motion.div>
      )}

      {/* Today's tasks */}
      <div>
        <h2 className="text-lg font-semibold mb-3">Today's Tasks ({todayTasks.length})</h2>
        {isLoading ? (
          <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}</div>
        ) : todayTasks.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground mb-3">No tasks for today</p>
            <div className="flex gap-2 justify-center">
              <CreateTaskDialog defaultDate={today} trigger={<Button variant="outline" size="sm">Add Task</Button>} />
              <Button variant="outline" size="sm" onClick={() => navigate('/ai-chat')}>
                <Sparkles className="w-3 h-3 mr-1" />Use AI
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">{todayTasks.map(task => <TaskCard key={task.id} task={task} onEdit={setEditTask} />)}</div>
        )}
      </div>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold mb-3">Upcoming</h2>
          <div className="space-y-2">{upcoming.map(t => <TaskCard key={t.id} task={t} onEdit={setEditTask} />)}</div>
        </div>
      )}

      {editTask && <CreateTaskDialog editTask={editTask} onClose={() => setEditTask(null)} />}
    </div>
  );
}
