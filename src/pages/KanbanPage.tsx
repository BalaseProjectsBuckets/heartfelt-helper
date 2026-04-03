import { useState } from 'react';
import { useTasks, Task } from '@/hooks/useTasks';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Trash2, Edit, CheckCircle2, Clock, XCircle, RefreshCw, GripVertical } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const PHASES = [
  { key: 'planning', label: 'Planning', color: 'bg-info/20 text-info border-info/30' },
  { key: 'requirements', label: 'Requirements', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  { key: 'design', label: 'Design', color: 'bg-pink-500/20 text-pink-400 border-pink-500/30' },
  { key: 'development', label: 'Development', color: 'bg-warning/20 text-warning border-warning/30' },
  { key: 'testing', label: 'Testing', color: 'bg-accent/20 text-accent border-accent/30' },
  { key: 'deployment', label: 'Deployment', color: 'bg-success/20 text-success border-success/30' },
  { key: 'maintenance', label: 'Maintenance', color: 'bg-muted text-muted-foreground border-border' },
];

const statusIcons: Record<string, any> = {
  pending: Clock,
  in_progress: Clock,
  completed: CheckCircle2,
  not_completed: XCircle,
  rescheduled: RefreshCw,
};

const priorityDots: Record<string, string> = {
  low: 'bg-muted-foreground',
  medium: 'bg-primary',
  high: 'bg-warning',
  urgent: 'bg-destructive',
};

export default function KanbanPage() {
  const { tasks, isLoading, updateTask, deleteTask } = useTasks();
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<string | null>(null);

  const handleDrop = (phase: string) => {
    if (draggedTask) {
      updateTask.mutate({ id: draggedTask, phase } as any);
      setDraggedTask(null);
    }
  };

  const handleStatusChange = (task: Task, newStatus: string) => {
    const updates: any = { id: task.id, status: newStatus };
    if (newStatus === 'completed') updates.completion_percentage = 100;
    if (newStatus === 'rescheduled') {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      updates.rescheduled_to = tomorrow.toISOString().split('T')[0];
    }
    updateTask.mutate(updates);
  };

  return (
    <div className="p-6 lg:p-8 space-y-5">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Project Board</h1>
        <CreateTaskDialog />
      </motion.div>

      {isLoading ? (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {PHASES.slice(0, 4).map(p => (
            <div key={p.key} className="w-72 shrink-0 h-64 bg-muted rounded-lg animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-6 px-6">
          {PHASES.map(phase => {
            const phaseTasks = tasks.filter(t => (t as any).phase === phase.key || (!((t as any).phase) && phase.key === 'planning'));
            return (
              <div
                key={phase.key}
                className="w-72 shrink-0 flex flex-col"
                onDragOver={e => e.preventDefault()}
                onDrop={() => handleDrop(phase.key)}
              >
                <div className={cn('rounded-t-lg px-3 py-2 border flex items-center justify-between', phase.color)}>
                  <span className="text-sm font-semibold">{phase.label}</span>
                  <Badge variant="secondary" className="text-[10px] h-5">{phaseTasks.length}</Badge>
                </div>
                <div className="flex-1 bg-muted/30 rounded-b-lg border border-t-0 border-border/50 p-2 space-y-2 min-h-[200px]">
                  {phaseTasks.map(task => {
                    const StatusIcon = statusIcons[task.status] || Clock;
                    return (
                      <motion.div
                        key={task.id}
                        layout
                        draggable
                        onDragStart={() => setDraggedTask(task.id)}
                        className="glass-card rounded-lg p-3 cursor-grab active:cursor-grabbing hover:task-glow transition-all group"
                      >
                        <div className="flex items-start gap-2">
                          <GripVertical className="w-3.5 h-3.5 text-muted-foreground mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 mb-1">
                              <span className={cn('w-2 h-2 rounded-full shrink-0', priorityDots[task.priority])} />
                              <h4 className={cn('text-xs font-semibold truncate', task.status === 'completed' && 'line-through text-muted-foreground')}>
                                {task.title}
                              </h4>
                            </div>
                            {task.description && (
                              <p className="text-[10px] text-muted-foreground line-clamp-2 mb-1.5">{task.description}</p>
                            )}
                            <div className="flex items-center gap-1.5">
                              <StatusIcon className="w-3 h-3 text-muted-foreground" />
                              <span className="text-[10px] text-muted-foreground">{task.scheduled_date}</span>
                              {task.category && (
                                <Badge variant="secondary" className="text-[9px] h-4 px-1">{task.category}</Badge>
                              )}
                            </div>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreHorizontal className="w-3 h-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-36">
                              <DropdownMenuItem onClick={() => setEditTask(task)}><Edit className="w-3 h-3 mr-2" />Edit</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(task, 'completed')}><CheckCircle2 className="w-3 h-3 mr-2" />Complete</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(task, 'in_progress')}><Clock className="w-3 h-3 mr-2" />In Progress</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleStatusChange(task, 'rescheduled')}><RefreshCw className="w-3 h-3 mr-2" />Reschedule</DropdownMenuItem>
                              <DropdownMenuItem onClick={() => deleteTask.mutate(task.id)} className="text-destructive"><Trash2 className="w-3 h-3 mr-2" />Delete</DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {editTask && <CreateTaskDialog editTask={editTask} onClose={() => setEditTask(null)} />}
    </div>
  );
}
