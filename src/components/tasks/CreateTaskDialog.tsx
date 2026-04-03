import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useTasks, Task } from '@/hooks/useTasks';
import { Plus, Trash2 } from 'lucide-react';

interface CreateTaskDialogProps {
  defaultDate?: string;
  editTask?: Task | null;
  onClose?: () => void;
  trigger?: React.ReactNode;
}

export function CreateTaskDialog({ defaultDate, editTask, onClose, trigger }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const { createTask, updateTask, deleteTask } = useTasks();

  const today = new Date().toISOString().split('T')[0];

  const defaultForm = {
    title: '',
    description: '',
    scheduled_date: defaultDate || today,
    start_time: '',
    end_time: '',
    priority: 'medium',
    category: '',
    phase: 'planning',
    status: 'pending',
    notes: '',
    youtube_links: '',
  };

  const [form, setForm] = useState(defaultForm);

  useEffect(() => {
    if (editTask) {
      setForm({
        title: editTask.title || '',
        description: editTask.description || '',
        scheduled_date: editTask.scheduled_date || defaultDate || today,
        start_time: editTask.start_time?.slice(0, 5) || '',
        end_time: editTask.end_time?.slice(0, 5) || '',
        priority: editTask.priority || 'medium',
        category: editTask.category || '',
        phase: (editTask as any)?.phase || 'planning',
        status: editTask.status || 'pending',
        notes: editTask.notes || '',
        youtube_links: editTask.youtube_links?.join('\n') || '',
      });
    } else {
      setForm({ ...defaultForm, scheduled_date: defaultDate || today });
    }
  }, [editTask, defaultDate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ytLinks = form.youtube_links.split('\n').map(l => l.trim()).filter(Boolean);
    const payload: any = {
      title: form.title,
      description: form.description || null,
      scheduled_date: form.scheduled_date,
      start_time: form.start_time || null,
      end_time: form.end_time || null,
      priority: form.priority,
      category: form.category || null,
      phase: form.phase,
      status: form.status,
      notes: form.notes || null,
      youtube_links: ytLinks.length > 0 ? ytLinks : [],
    };

    if (editTask) {
      updateTask.mutate({ id: editTask.id, ...payload });
    } else {
      createTask.mutate(payload);
    }
    setOpen(false);
    onClose?.();
  };

  const handleDelete = () => {
    if (editTask) {
      deleteTask.mutate(editTask.id);
      setOpen(false);
      onClose?.();
    }
  };

  const isControlled = editTask !== undefined;

  return (
    <Dialog open={isControlled ? !!editTask : open} onOpenChange={v => { if (isControlled) { if (!v) onClose?.(); } else setOpen(v); }}>
      {!isControlled && (
        <DialogTrigger asChild>
          {trigger || <Button size="sm" className="gradient-primary text-primary-foreground"><Plus className="w-4 h-4 mr-1" />Add Task</Button>}
        </DialogTrigger>
      )}
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editTask ? 'Edit Task' : 'Create Task'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Title *</Label>
            <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} required placeholder="Task title" />
          </div>
          <div>
            <Label>Description</Label>
            <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What needs to be done?" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Date *</Label>
              <Input type="date" value={form.scheduled_date} onChange={e => setForm(f => ({ ...f, scheduled_date: e.target.value }))} required />
            </div>
            <div>
              <Label>Priority</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">🟢 Low</SelectItem>
                  <SelectItem value="medium">🟡 Medium</SelectItem>
                  <SelectItem value="high">🟠 High</SelectItem>
                  <SelectItem value="urgent">🔴 Urgent</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Start Time</Label>
              <Input type="time" value={form.start_time} onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))} />
            </div>
            <div>
              <Label>End Time</Label>
              <Input type="time" value={form.end_time} onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Category</Label>
              <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} placeholder="e.g. English, GK" />
            </div>
            <div>
              <Label>Phase</Label>
              <Select value={form.phase} onValueChange={v => setForm(f => ({ ...f, phase: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">📋 Planning</SelectItem>
                  <SelectItem value="requirements">📝 Requirements</SelectItem>
                  <SelectItem value="design">🎨 Design</SelectItem>
                  <SelectItem value="development">💻 Development</SelectItem>
                  <SelectItem value="testing">🧪 Testing</SelectItem>
                  <SelectItem value="deployment">🚀 Deployment</SelectItem>
                  <SelectItem value="maintenance">🔧 Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {editTask && (
            <div>
              <Label>Status</Label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">⏳ Pending</SelectItem>
                  <SelectItem value="in_progress">🔄 In Progress</SelectItem>
                  <SelectItem value="completed">✅ Completed</SelectItem>
                  <SelectItem value="not_completed">❌ Not Completed</SelectItem>
                  <SelectItem value="rescheduled">📅 Rescheduled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Additional notes..." rows={2} />
          </div>
          <div>
            <Label>YouTube Links (one per line)</Label>
            <Textarea value={form.youtube_links} onChange={e => setForm(f => ({ ...f, youtube_links: e.target.value }))} placeholder="https://youtube.com/watch?v=..." rows={2} />
          </div>
          <div className="flex gap-2">
            <Button type="submit" className="flex-1 gradient-primary text-primary-foreground">
              {editTask ? 'Update Task' : 'Create Task'}
            </Button>
            {editTask && (
              <Button type="button" variant="outline" className="text-destructive hover:text-destructive" onClick={handleDelete}>
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
