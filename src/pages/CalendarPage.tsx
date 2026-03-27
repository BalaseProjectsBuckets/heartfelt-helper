import { useState } from 'react';
import { useTasks, Task } from '@/hooks/useTasks';
import { TaskCard } from '@/components/tasks/TaskCard';
import { CreateTaskDialog } from '@/components/tasks/CreateTaskDialog';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, isToday, startOfWeek, endOfWeek } from 'date-fns';

export default function CalendarPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const selectedDateStr = format(selectedDate, 'yyyy-MM-dd');
  const { tasks } = useTasks();
  const { tasks: dayTasks } = useTasks(selectedDateStr);
  const [editTask, setEditTask] = useState<Task | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calStart, end: calEnd });

  const getTaskCount = (date: Date) => tasks.filter(t => t.scheduled_date === format(date, 'yyyy-MM-dd')).length;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-5">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Calendar</h1>
        <CreateTaskDialog defaultDate={selectedDateStr} />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 glass-card rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => subMonths(m, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h2 className="font-semibold">{format(currentMonth, 'MMMM yyyy')}</h2>
            <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(m => addMonths(m, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
              <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map(day => {
              const count = getTaskCount(day);
              const selected = isSameDay(day, selectedDate);
              const today_ = isToday(day);
              const inMonth = day.getMonth() === currentMonth.getMonth();

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDate(day)}
                  className={cn(
                    'relative aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-all',
                    !inMonth && 'text-muted-foreground/40',
                    selected && 'bg-primary text-primary-foreground',
                    !selected && today_ && 'bg-primary/10 text-primary font-bold',
                    !selected && inMonth && 'hover:bg-muted'
                  )}
                >
                  {format(day, 'd')}
                  {count > 0 && (
                    <div className={cn('absolute bottom-1 w-1.5 h-1.5 rounded-full', selected ? 'bg-primary-foreground' : 'bg-primary')} />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Day Detail */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">{format(selectedDate, 'EEE, MMM d')}</h3>
            <CreateTaskDialog defaultDate={selectedDateStr} trigger={<Button variant="ghost" size="icon"><Plus className="w-4 h-4" /></Button>} />
          </div>
          <AnimatePresence mode="wait">
            {dayTasks.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="glass-card rounded-lg p-6 text-center text-sm text-muted-foreground">
                No tasks for this day
              </motion.div>
            ) : (
              <motion.div key={selectedDateStr} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                {dayTasks.map(t => <TaskCard key={t.id} task={t} onEdit={setEditTask} />)}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {editTask && <CreateTaskDialog editTask={editTask} onClose={() => setEditTask(null)} />}
    </div>
  );
}
