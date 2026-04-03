import { useState } from 'react';
import { useTasks, Task } from '@/hooks/useTasks';
import { TaskCard } from '@/components/tasks/TaskCard';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Trash2, CheckCircle2, Clock, XSquare } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';

export default function TasksPage() {
  const { tasks, isLoading, updateTask, deleteTask } = useTasks();
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [phaseFilter, setPhaseFilter] = useState('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const filtered = tasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase()) && !t.description?.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
    if (phaseFilter !== 'all' && (t as any).phase !== phaseFilter) return false;
    return true;
  });

  const toggleSelect = (id: string, checked: boolean) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (checked) next.add(id); else next.delete(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(filtered.map(t => t.id)));
    }
  };

  const bulkAction = (action: 'delete' | 'completed' | 'in_progress' | 'not_completed') => {
    if (selected.size === 0) return;
    if (action === 'delete') {
      selected.forEach(id => deleteTask.mutate(id));
      toast({ title: `${selected.size} tasks deleted` });
    } else {
      selected.forEach(id => {
        const updates: any = { id, status: action };
        if (action === 'completed') updates.completion_percentage = 100;
        updateTask.mutate(updates);
      });
      toast({ title: `${selected.size} tasks updated to ${action.replace('_', ' ')}` });
    }
    setSelected(new Set());
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-5">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">All Tasks</h1>
          <p className="text-sm text-muted-foreground">{tasks.length} total · {tasks.filter(t => t.status === 'completed').length} completed</p>
        </div>
        <CreateTaskDialog />
      </motion.div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search tasks..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Status" /></SelectTrigger>
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
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="low">Low</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="urgent">Urgent</SelectItem>
          </SelectContent>
        </Select>
        <Select value={phaseFilter} onValueChange={setPhaseFilter}>
          <SelectTrigger className="w-[130px]"><SelectValue placeholder="Phase" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Phases</SelectItem>
            <SelectItem value="planning">Planning</SelectItem>
            <SelectItem value="requirements">Requirements</SelectItem>
            <SelectItem value="design">Design</SelectItem>
            <SelectItem value="development">Development</SelectItem>
            <SelectItem value="testing">Testing</SelectItem>
            <SelectItem value="deployment">Deployment</SelectItem>
            <SelectItem value="maintenance">Maintenance</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="outline" size="sm" onClick={selectAll} className="text-xs">
          {selected.size === filtered.length && filtered.length > 0 ? 'Deselect All' : 'Select All'}
        </Button>
        {selected.size > 0 && (
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">{selected.size} selected</span>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => bulkAction('completed')}>
              <CheckCircle2 className="w-3 h-3 mr-1" />Complete
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => bulkAction('in_progress')}>
              <Clock className="w-3 h-3 mr-1" />In Progress
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7" onClick={() => bulkAction('not_completed')}>
              <XSquare className="w-3 h-3 mr-1" />Not Done
            </Button>
            <Button variant="outline" size="sm" className="text-xs h-7 text-destructive hover:text-destructive" onClick={() => bulkAction('delete')}>
              <Trash2 className="w-3 h-3 mr-1" />Delete
            </Button>
          </motion.div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2, 3].map(i => <div key={i} className="h-20 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-xl p-8 text-center text-muted-foreground">
          {tasks.length === 0 ? 'No tasks yet — create one or use AI Planner!' : 'No tasks match your filters'}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <TaskCard
              key={t.id}
              task={t}
              onEdit={setEditTask}
              selectable
              selected={selected.has(t.id)}
              onSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {editTask && <CreateTaskDialog editTask={editTask} onClose={() => setEditTask(null)} />}
    </div>
  );
}
