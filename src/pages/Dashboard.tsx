import { StatsCards } from '@/components/dashboard/StatsCards';
import { useTasks } from '@/hooks/useTasks';
import { TaskCard } from '@/components/tasks/TaskCard';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { useState } from 'react';
import { Task } from '@/hooks/useTasks';
import { motion } from 'framer-motion';
import { CalendarDays, Sparkles } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

export default function Dashboard() {
  const today = new Date().toISOString().split('T')[0];
  const { tasks, isLoading } = useTasks(today);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const navigate = useNavigate();

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

      <div>
        <h2 className="text-lg font-semibold mb-3">Today's Tasks</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}
          </div>
        ) : tasks.length === 0 ? (
          <div className="glass-card rounded-xl p-8 text-center">
            <p className="text-muted-foreground mb-3">No tasks for today</p>
            <CreateTaskDialog defaultDate={today} trigger={<Button variant="outline" size="sm">Add your first task</Button>} />
          </div>
        ) : (
          <div className="space-y-2">
            {tasks.map(task => <TaskCard key={task.id} task={task} onEdit={setEditTask} />)}
          </div>
        )}
      </div>

      {editTask && <CreateTaskDialog editTask={editTask} onClose={() => setEditTask(null)} />}
    </div>
  );
}
