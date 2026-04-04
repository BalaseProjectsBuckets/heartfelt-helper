import { useState } from 'react';
import { useTasks, Task } from '@/hooks/useTasks';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Trash2, Edit, CheckCircle2, Clock, XCircle, RefreshCw, GripVertical, Search, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

const PHASES = [
  { key: 'planning',     label: '📋 Planning',     bg: 'bg-blue-500/10',   border: 'border-blue-500/30',   text: 'text-blue-400',   dot: 'bg-blue-400' },
  { key: 'requirements', label: '📝 Requirements', bg: 'bg-purple-500/10', border: 'border-purple-500/30', text: 'text-purple-400', dot: 'bg-purple-400' },
  { key: 'design',       label: '🎨 Design',       bg: 'bg-pink-500/10',   border: 'border-pink-500/30',   text: 'text-pink-400',   dot: 'bg-pink-400' },
  { key: 'development',  label: '💻 Development',  bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', text: 'text-yellow-400', dot: 'bg-yellow-400' },
  { key: 'testing',      label: '🧪 Testing',      bg: 'bg-cyan-500/10',   border: 'border-cyan-500/30',   text: 'text-cyan-400',   dot: 'bg-cyan-400' },
  { key: 'deployment',   label: '🚀 Deployment',   bg: 'bg-green-500/10',  border: 'border-green-500/30',  text: 'text-green-400',  dot: 'bg-green-400' },
  { key: 'maintenance',  label: '🔧 Maintenance',  bg: 'bg-muted',         border: 'border-border',        text: 'text-muted-foreground', dot: 'bg-muted-foreground' },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-muted-foreground/60',
  medium: 'bg-blue-400',
  high: 'bg-yellow-400',
  urgent: 'bg-red-400',
};

const STATUS_ICONS: Record<string, any> = {
  pending: Clock,
  in_progress: Clock,
  completed: CheckCircle2,
  not_completed: XCircle,
  rescheduled: RefreshCw,
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-muted-foreground',
  in_progress: 'text-yellow-400',
  completed: 'text-green-400',
  not_completed: 'text-red-400',
  rescheduled: 'text-blue-400',
};

export default function KanbanPage() {
  const { tasks, isLoading, updateTask, deleteTask } = useTasks();
  const [editTask, setEditTask]     = useState<Task | null>(null);
  const [draggedId, setDraggedId]   = useState<string | null>(null);
  const [dragOverPhase, setDragOver] = useState<string | null>(null);
  const [search, setSearch]         = useState('');

  const filtered = search
    ? tasks.filter(t =>
        t.title.toLowerCase().includes(search.toLowerCase()) ||
        t.category?.toLowerCase().includes(search.toLowerCase()) ||
        t.description?.toLowerCase().includes(search.toLowerCase())
      )
    : tasks;

  const getPhaseTask = (phaseKey: string) =>
    filtered.filter(t =>
      (t as any).phase === phaseKey ||
      (!(t as any).phase && phaseKey === 'planning')
    );

  const handleDrop = (phaseKey: string) => {
    if (draggedId) {
      updateTask.mutate({ id: draggedId, phase: phaseKey } as any);
      setDraggedId(null);
      setDragOver(null);
    }
  };

  const handleStatusChange = (task: Task, newStatus: string) => {
    const updates: any = { id: task.id, status: newStatus };
    if (newStatus === 'completed') updates.completion_percentage = 100;
    if (newStatus === 'rescheduled') {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      updates.rescheduled_to = d.toISOString().split('T')[0];
    }
    updateTask.mutate(updates);
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
        <div>
          <h1 className="text-xl font-bold">Project Board</h1>
          <p className="text-xs text-muted-foreground">{tasks.length} tasks across {PHASES.length} phases</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search tasks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 w-48 text-xs"
            />
          </div>
          <CreateTaskDialog />
        </div>
      </div>

      {/* ── Board ── */}
      {isLoading ? (
        <div className="flex gap-4 p-6 overflow-x-auto">
          {PHASES.map(p => (
            <div key={p.key} className="w-64 shrink-0 h-48 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="flex gap-3 p-4 overflow-x-auto flex-1 min-h-0">
          {PHASES.map(phase => {
            const phaseTasks = getPhaseTask(phase.key);
            const isDragOver = dragOverPhase === phase.key;

            return (
              <div
                key={phase.key}
                className={cn(
                  'flex flex-col rounded-xl border transition-all shrink-0',
                  'w-[260px]',
                  phase.border,
                  isDragOver ? 'ring-2 ring-primary/40 scale-[1.01]' : ''
                )}
                onDragOver={e => { e.preventDefault(); setDragOver(phase.key); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => handleDrop(phase.key)}
              >
                {/* Column header */}
                <div className={cn('flex items-center justify-between px-3 py-2.5 rounded-t-xl', phase.bg)}>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-semibold', phase.text)}>{phase.label}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge className={cn('text-[10px] h-4 px-1.5 border-0', phase.bg, phase.text)}>
                      {phaseTasks.length}
                    </Badge>
                    <CreateTaskDialog
                      trigger={
                        <Button variant="ghost" size="icon" className={cn('h-5 w-5', phase.text)}>
                          <Plus className="w-3 h-3" />
                        </Button>
                      }
                    />
                  </div>
                </div>

                {/* Cards list */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-160px)]">
                  {phaseTasks.length === 0 && (
                    <div className="flex items-center justify-center h-16 text-[10px] text-muted-foreground/50 border border-dashed border-border/50 rounded-lg">
                      Drop tasks here
                    </div>
                  )}

                  {phaseTasks.map(task => {
                    const StatusIcon = STATUS_ICONS[task.status] || Clock;
                    return (
                      <motion.div
                        key={task.id}
                        layout
                        draggable
                        onDragStart={() => setDraggedId(task.id)}
                        onDragEnd={() => { setDraggedId(null); setDragOver(null); }}
                        className={cn(
                          'glass-card rounded-lg p-2.5 cursor-grab active:cursor-grabbing',
                          'hover:shadow-md hover:border-primary/20 transition-all group',
                          draggedId === task.id && 'opacity-40'
                        )}
                      >
                        <div className="flex items-start gap-1.5">
                          <GripVertical className="w-3 h-3 text-muted-foreground/40 mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                          <div className="flex-1 min-w-0">
                            {/* Title row */}
                            <div className="flex items-start justify-between gap-1 mb-1">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0 mt-0.5', PRIORITY_COLORS[task.priority])} />
                                <h4 className={cn(
                                  'text-xs font-medium leading-tight',
                                  task.status === 'completed' && 'line-through text-muted-foreground'
                                )}>
                                  {task.title}
                                </h4>
                              </div>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity -mt-0.5">
                                    <MoreHorizontal className="w-3 h-3" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-36 text-xs">
                                  <DropdownMenuItem onClick={() => setEditTask(task)}><Edit className="w-3 h-3 mr-2" />Edit</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleStatusChange(task, 'completed')}><CheckCircle2 className="w-3 h-3 mr-2" />Complete</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleStatusChange(task, 'in_progress')}><Clock className="w-3 h-3 mr-2" />In Progress</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleStatusChange(task, 'not_completed')}><XCircle className="w-3 h-3 mr-2" />Not Done</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleStatusChange(task, 'rescheduled')}><RefreshCw className="w-3 h-3 mr-2" />Reschedule</DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => deleteTask.mutate(task.id)} className="text-destructive"><Trash2 className="w-3 h-3 mr-2" />Delete</DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            {/* Description */}
                            {task.description && (
                              <p className="text-[10px] text-muted-foreground line-clamp-2 mb-1.5 leading-relaxed">
                                {task.description}
                              </p>
                            )}

                            {/* Footer meta */}
                            <div className="flex items-center justify-between gap-1 flex-wrap">
                              <div className="flex items-center gap-1">
                                <StatusIcon className={cn('w-2.5 h-2.5', STATUS_COLORS[task.status])} />
                                <span className="text-[10px] text-muted-foreground font-mono">{task.scheduled_date}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                {task.category && (
                                  <Badge variant="secondary" className="text-[9px] h-3.5 px-1 py-0">{task.category}</Badge>
                                )}
                                {task.rescheduled_to && (
                                  <Badge variant="outline" className="text-[9px] h-3.5 px-1 py-0 text-blue-400 border-blue-400/30">
                                    →{task.rescheduled_to}
                                  </Badge>
                                )}
                              </div>
                            </div>

                            {/* Progress bar if in progress */}
                            {task.completion_percentage !== null && task.completion_percentage > 0 && task.completion_percentage < 100 && (
                              <div className="mt-1.5 h-0.5 bg-muted rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-primary rounded-full transition-all"
                                  style={{ width: `${task.completion_percentage}%` }}
                                />
                              </div>
                            )}
                          </div>
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
