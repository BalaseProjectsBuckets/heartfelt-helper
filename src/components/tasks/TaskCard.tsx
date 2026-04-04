import { useState } from 'react';
import { Task, useTasks } from '@/hooks/useTasks';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Trash2, Edit, CheckCircle2, Clock, XCircle, RefreshCw, ChevronDown, ChevronUp, ExternalLink, StickyNote, Youtube, Bot } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { TaskChatDrawer } from './TaskChatDrawer';

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

const phaseLabels: Record<string, string> = {
  planning: 'Planning',
  requirements: 'Requirements',
  design: 'Design',
  development: 'Development',
  testing: 'Testing',
  deployment: 'Deployment',
  maintenance: 'Maintenance',
};

interface TaskCardProps {
  task: Task;
  onEdit?: (task: Task) => void;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string, checked: boolean) => void;
}

export function TaskCard({ task, onEdit, selectable, selected, onSelect }: TaskCardProps) {
  const { updateTask, deleteTask } = useTasks();
  const [expanded, setExpanded] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notes, setNotes] = useState(task.notes || '');
  const [chatOpen, setChatOpen] = useState(false);
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

  const handleCompletionChange = (value: number[]) => {
    const pct = value[0];
    updateTask.mutate({
      id: task.id,
      completion_percentage: pct,
      status: pct === 100 ? 'completed' : pct > 0 ? 'in_progress' : 'pending',
    } as any);
  };

  const saveNotes = () => {
    updateTask.mutate({ id: task.id, notes: notes || null } as any);
    setEditingNotes(false);
  };

  const phase = (task as any).phase;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'glass-card rounded-lg border-l-4 transition-all hover:task-glow',
        priorityColors[task.priority] || 'border-l-primary',
        selected && 'ring-2 ring-primary/50'
      )}
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {selectable && (
            <Checkbox
              checked={selected}
              onCheckedChange={(checked) => onSelect?.(task.id, !!checked)}
              className="mt-1 shrink-0"
            />
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h3 className={cn('text-sm font-semibold truncate', task.status === 'completed' && 'line-through text-muted-foreground')}>
                {task.title}
              </h3>
              <Badge variant="outline" className={cn('text-[10px] shrink-0', status.className)}>
                <StatusIcon className="w-3 h-3 mr-1" />
                {status.label}
              </Badge>
              {phase && phase !== 'planning' && (
                <Badge variant="secondary" className="text-[10px]">{phaseLabels[phase] || phase}</Badge>
              )}
            </div>
            {task.description && <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>}
            <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
              <span className="font-mono">{task.scheduled_date}</span>
              {task.start_time && <span>{task.start_time.slice(0, 5)} – {task.end_time?.slice(0, 5)}</span>}
              {task.category && <Badge variant="secondary" className="text-[10px]">{task.category}</Badge>}
              {task.completion_percentage !== null && task.completion_percentage > 0 && task.completion_percentage < 100 && (
                <span className="text-warning font-mono">{task.completion_percentage}%</span>
              )}
              {task.youtube_links && task.youtube_links.length > 0 && (
                <span className="flex items-center gap-0.5"><Youtube className="w-3 h-3" />{task.youtube_links.length}</span>
              )}
              {task.notes && <StickyNote className="w-3 h-3" />}
              {task.status === 'rescheduled' && task.rescheduled_to && (
                <span className="flex items-center gap-1 text-[10px] text-blue-400 font-mono">
                  <RefreshCw className="w-3 h-3" />→ {task.rescheduled_to}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-7 w-7" title="AI Chat" onClick={() => setChatOpen(true)}>
              <Bot className="w-4 h-4 text-primary" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {onEdit && <DropdownMenuItem onClick={() => onEdit(task)}><Edit className="w-3 h-3 mr-2" />Edit</DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleStatusChange('completed')}><CheckCircle2 className="w-3 h-3 mr-2" />Complete</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange('in_progress')}><Clock className="w-3 h-3 mr-2" />In Progress</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange('not_completed')}><XCircle className="w-3 h-3 mr-2" />Not Completed</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusChange('rescheduled')}><RefreshCw className="w-3 h-3 mr-2" />Reschedule</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => deleteTask.mutate(task.id)} className="text-destructive"><Trash2 className="w-3 h-3 mr-2" />Delete</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
              {/* Completion slider */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">Progress</span>
                  <span className="text-xs font-mono text-muted-foreground">{task.completion_percentage ?? 0}%</span>
                </div>
                <Slider
                  value={[task.completion_percentage ?? 0]}
                  onValueCommit={handleCompletionChange}
                  max={100}
                  step={5}
                  className="w-full"
                />
              </div>

              {/* YouTube links */}
              {task.youtube_links && task.youtube_links.length > 0 && (
                <div>
                  <span className="text-xs font-medium mb-1 block">YouTube Links</span>
                  <div className="space-y-1">
                    {task.youtube_links.map((link, i) => (
                      <a
                        key={i}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-primary hover:underline truncate"
                      >
                        <ExternalLink className="w-3 h-3 shrink-0" />
                        {link}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">Notes</span>
                  {!editingNotes && (
                    <Button variant="ghost" size="sm" className="h-5 text-[10px] px-1.5" onClick={() => setEditingNotes(true)}>
                      {task.notes ? 'Edit' : 'Add'}
                    </Button>
                  )}
                </div>
                {editingNotes ? (
                  <div className="space-y-2">
                    <Textarea
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      placeholder="Add notes..."
                      rows={3}
                      className="text-xs"
                    />
                    <div className="flex gap-2">
                      <Button size="sm" className="h-6 text-[10px]" onClick={saveNotes}>Save</Button>
                      <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => { setEditingNotes(false); setNotes(task.notes || ''); }}>Cancel</Button>
                    </div>
                  </div>
                ) : (
                  task.notes && <p className="text-xs text-muted-foreground whitespace-pre-wrap">{task.notes}</p>
                )}
              </div>

              {/* Quick status buttons */}
              <div className="flex gap-1.5 flex-wrap">
                {Object.entries(statusConfig).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  return (
                    <Button
                      key={key}
                      variant={task.status === key ? 'default' : 'outline'}
                      size="sm"
                      className={cn('h-6 text-[10px] px-2', task.status === key && 'gradient-primary text-primary-foreground')}
                      onClick={() => handleStatusChange(key)}
                    >
                      <Icon className="w-3 h-3 mr-1" />{cfg.label}
                    </Button>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <TaskChatDrawer task={task} open={chatOpen} onClose={() => setChatOpen(false)} />
    </motion.div>
  );
}
