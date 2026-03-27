import { useState } from 'react';
import { Task, useTasks } from '@/hooks/useTasks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Trash2, Edit, CheckCircle2, Clock, XCircle, RefreshCw, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
  pending: { label: 'Pending', className: 'bg-muted text-muted-foreground', icon: Clock },
  in_progress: { label: 'In Progress', className: 'bg-warning/10 text-warning', icon: Clock },
  completed: { label: 'Completed', className: 'bg-success/10 text-success', icon: CheckCircle2 },
  not_completed: { label: 'Not Done', className: 'bg-destructive/10 text-destructive', icon: XCircle },
  rescheduled: { label: 'Rescheduled', className: 'bg-info/10 text-info', icon: RefreshCw },
};

const priorityColors: Record<string, string> = {
  low: 'border-l-muted-foreground',
  medium: 'border-l-primary',
  high: 'border-l-warning',
  urgent: 'border-l-destructive',
};

interface TaskCardProps {
  task: Task;
  onEdit?: (task: Task) => void;
}

export function TaskCard({ task, onEdit }: TaskCardProps) {
  const { updateTask, deleteTask } = useTasks();
  const status = statusConfig[task.status] || statusConfig.pending;
  const StatusIcon = status.icon;

  const handleStatusChange = (newStatus: string) => {
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
    <motion.div
      layout
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('glass-card rounded-lg p-4 border-l-4 transition-all hover:task-glow', priorityColors[task.priority] || 'border-l-primary')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className={cn('text-sm font-semibold truncate', task.status === 'completed' && 'line-through text-muted-foreground')}>
              {task.title}
            </h3>
            <Badge variant="outline" className={cn('text-[10px] shrink-0', status.className)}>
              <StatusIcon className="w-3 h-3 mr-1" />
              {status.label}
            </Badge>
          </div>
          {task.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {task.start_time && <span>{task.start_time.slice(0, 5)} - {task.end_time?.slice(0, 5)}</span>}
            {task.category && <Badge variant="secondary" className="text-[10px]">{task.category}</Badge>}
            {task.completion_percentage !== null && task.completion_percentage > 0 && task.completion_percentage < 100 && (
              <span className="text-warning font-mono">{task.completion_percentage}%</span>
            )}
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onEdit && <DropdownMenuItem onClick={() => onEdit(task)}><Edit className="w-3 h-3 mr-2" />Edit</DropdownMenuItem>}
            <DropdownMenuItem onClick={() => handleStatusChange('completed')}><CheckCircle2 className="w-3 h-3 mr-2" />Complete</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange('in_progress')}><Clock className="w-3 h-3 mr-2" />In Progress</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange('not_completed')}><XCircle className="w-3 h-3 mr-2" />Not Completed</DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleStatusChange('rescheduled')}><RefreshCw className="w-3 h-3 mr-2" />Reschedule</DropdownMenuItem>
            <DropdownMenuItem onClick={() => deleteTask.mutate(task.id)} className="text-destructive"><Trash2 className="w-3 h-3 mr-2" />Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </motion.div>
  );
}
