import { useState } from 'react';
import { useTasks, Task } from '@/hooks/useTasks';
import { TaskCard } from '@/components/tasks/TaskCard';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TasksPage() {
  const { tasks, isLoading } = useTasks();
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const filtered = tasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    return true;
  });

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-5">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">All Tasks</h1>
        <CreateTaskDialog />
      </motion.div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="not_completed">Not Done</SelectItem>
            <SelectItem value="rescheduled">Rescheduled</SelectItem>
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">No tasks found</div>
      ) : (
        <div className="space-y-2">{filtered.map(t => <TaskCard key={t.id} task={t} onEdit={setEditTask} />)}</div>
      )}

      {editTask && <CreateTaskDialog editTask={editTask} onClose={() => setEditTask(null)} />}
    </div>
  );
}
