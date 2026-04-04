import { useState, useMemo } from 'react';
import { useTasks, Task } from '@/hooks/useTasks';
import { TaskCard } from '@/components/tasks/TaskCard';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, addMonths, subMonths, isToday,
  startOfWeek, endOfWeek,
} from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  pending:       'bg-muted-foreground',
  in_progress:   'bg-yellow-400',
  completed:     'bg-green-400',
  not_completed: 'bg-red-400',
  rescheduled:   'bg-blue-400',
};

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(new Date());
  const { tasks, isLoading } = useTasks();
  const [editTask, setEditTask] = useState<Task | null>(null);

  // Filters
  const [search, setSearch]           = useState('');
  const [statusFilter, setStatus]     = useState('all');
  const [priorityFilter, setPriority] = useState('all');
  const [categoryFilter, setCategory] = useState('all');

  // Unique categories from all tasks
  const categories = useMemo(() =>
    [...new Set(tasks.map(t => t.category).filter(Boolean))] as string[],
    [tasks]
  );

  // Apply all filters (ignoring date — date comes from calendar click)
  const applyFilters = (list: Task[]) =>
    list.filter(t => {
      if (search) {
        const q = search.toLowerCase();
        const hit =
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.category?.toLowerCase().includes(q) ||
          t.notes?.toLowerCase().includes(q) ||
          t.scheduled_date.includes(q) ||
          t.rescheduled_to?.includes(q) ||
          t.priority.includes(q) ||
          t.status.includes(q);
        if (!hit) return false;
      }
      if (statusFilter   !== 'all' && t.status   !== statusFilter)   return false;
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false;
      if (categoryFilter !== 'all' && t.category !== categoryFilter) return false;
      return true;
    });

  const activeFilters = [
    search && `"${search}"`,
    statusFilter   !== 'all' && statusFilter,
    priorityFilter !== 'all' && priorityFilter,
    categoryFilter !== 'all' && categoryFilter,
  ].filter(Boolean) as string[];

  const clearFilters = () => {
    setSearch(''); setStatus('all'); setPriority('all'); setCategory('all');
  };

  // Tasks shown in right panel: filtered + optionally date-scoped
  const panelTasks = useMemo(() => {
    const base = selectedDate
      ? tasks.filter(t => t.scheduled_date === format(selectedDate, 'yyyy-MM-dd') ||
                          t.rescheduled_to  === format(selectedDate, 'yyyy-MM-dd'))
      : tasks;
    return applyFilters(base);
  }, [tasks, selectedDate, search, statusFilter, priorityFilter, categoryFilter]);

  // For calendar dots: tasks per day after filters (so dots reflect active filters)
  const filteredAll = useMemo(() => applyFilters(tasks), [tasks, search, statusFilter, priorityFilter, categoryFilter]);

  const getStatusesForDay = (date: Date) => {
    const ds = format(date, 'yyyy-MM-dd');
    const dayTasks = filteredAll.filter(t => t.scheduled_date === ds || t.rescheduled_to === ds);
    return [...new Set(dayTasks.map(t => t.status))];
  };

  // Calendar grid
  const monthStart = startOfMonth(currentMonth);
  const monthEnd   = endOfMonth(currentMonth);
  const calStart   = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd     = endOfWeek(monthEnd,     { weekStartsOn: 1 });
  const days       = eachDayOfInterval({ start: calStart, end: calEnd });

  const selectedDateStr = selectedDate ? format(selectedDate, 'yyyy-MM-dd') : '';

  return (
    <div className="p-4 lg:p-6 max-w-7xl mx-auto space-y-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <CreateTaskDialog defaultDate={selectedDateStr || undefined} />
      </motion.div>

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Search title, date, category, status..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatus}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="not_completed">Not Done</SelectItem>
            <SelectItem value="rescheduled">Rescheduled</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriority}>
          <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Priority" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priority</SelectItem>
            <SelectItem value="low">🟢 Low</SelectItem>
            <SelectItem value="medium">🟡 Medium</SelectItem>
            <SelectItem value="high">🟠 High</SelectItem>
            <SelectItem value="urgent">🔴 Urgent</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoryFilter} onValueChange={setCategory}>
          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>

        {activeFilters.length > 0 && (
          <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={clearFilters}>
            <X className="w-3 h-3 mr-1" />Clear
          </Button>
        )}
      </div>

      {/* Active filter chips */}
      {activeFilters.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {selectedDate && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              📅 {format(selectedDate, 'MMM d')}
              <button onClick={() => setSelectedDate(null)}><X className="w-2.5 h-2.5" /></button>
            </Badge>
          )}
          {activeFilters.map(f => (
            <Badge key={f} variant="secondary" className="text-[10px]">{f}</Badge>
          ))}
          <span className="text-[10px] text-muted-foreground self-center">{panelTasks.length} task{panelTasks.length !== 1 ? 's' : ''}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* ── Calendar grid ── */}
        <div className="lg:col-span-2 glass-card rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="font-semibold text-sm">{format(currentMonth, 'MMMM yyyy')}</h2>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-1">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map(day => {
              const statuses  = getStatusesForDay(day);
              const selected  = selectedDate ? isSameDay(day, selectedDate) : false;
              const today_    = isToday(day);
              const inMonth   = day.getMonth() === currentMonth.getMonth();
              const hasReschedule = filteredAll.some(t => t.rescheduled_to === format(day, 'yyyy-MM-dd'));

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(prev => prev && isSameDay(prev, day) ? null : day)}
                  className={cn(
                    'relative aspect-square flex flex-col items-center justify-center rounded-lg text-xs transition-all',
                    !inMonth && 'text-muted-foreground/30',
                    selected && 'bg-primary text-primary-foreground',
                    !selected && today_ && 'bg-primary/10 text-primary font-bold ring-1 ring-primary/30',
                    !selected && inMonth && 'hover:bg-muted',
                    hasReschedule && !selected && 'ring-1 ring-blue-400/50',
                  )}
                >
                  <span>{format(day, 'd')}</span>
                  {/* Status dots */}
                  {statuses.length > 0 && (
                    <div className="absolute bottom-1 flex gap-0.5">
                      {statuses.slice(0, 3).map(s => (
                        <div
                          key={s}
                          className={cn('w-1 h-1 rounded-full', selected ? 'bg-primary-foreground' : STATUS_COLORS[s] || 'bg-primary')}
                        />
                      ))}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border/50">
            {Object.entries(STATUS_COLORS).map(([s, color]) => (
              <span key={s} className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className={cn('w-2 h-2 rounded-full', color)} />
                {s.replace('_', ' ')}
              </span>
            ))}
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <span className="w-2 h-2 rounded border border-blue-400" />rescheduled to
            </span>
          </div>
        </div>

        {/* ── Right panel ── */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm">
                {selectedDate ? format(selectedDate, 'EEE, MMM d') : 'All matching tasks'}
              </h3>
              <p className="text-[10px] text-muted-foreground">{panelTasks.length} task{panelTasks.length !== 1 ? 's' : ''}</p>
            </div>
            <CreateTaskDialog
              defaultDate={selectedDateStr || undefined}
              trigger={
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <span className="text-lg leading-none">+</span>
                </Button>
              }
            />
          </div>

          <AnimatePresence mode="wait">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}
              </div>
            ) : panelTasks.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="glass-card rounded-lg p-6 text-center text-xs text-muted-foreground"
              >
                {activeFilters.length > 0 ? 'No tasks match your filters' : 'No tasks for this day'}
              </motion.div>
            ) : (
              <motion.div
                key={selectedDateStr + statusFilter + priorityFilter + categoryFilter + search}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1"
              >
                {panelTasks.map(t => (
                  <TaskCard key={t.id} task={t} onEdit={setEditTask} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {editTask && <CreateTaskDialog editTask={editTask} onClose={() => setEditTask(null)} />}
    </div>
  );
}
