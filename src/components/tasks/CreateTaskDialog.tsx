import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useTasks, Task } from '@/hooks/useTasks';
import { Plus, Trash2, Sparkles, Send, Loader2, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface CreateTaskDialogProps {
  defaultDate?: string;
  editTask?: Task | null;
  onClose?: () => void;
  trigger?: React.ReactNode;
}

interface AiMessage { role: 'user' | 'assistant'; content: string; }

export function CreateTaskDialog({ defaultDate, editTask, onClose, trigger }: CreateTaskDialogProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'manual' | 'ai'>('manual');
  const { createTask, updateTask, deleteTask } = useTasks();
  const { user } = useAuth();

  // AI chat state
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiConvId, setAiConvId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [aiMessages]);

  // Reset AI chat when dialog closes
  useEffect(() => {
    if (!open) { setAiMessages([]); setAiConvId(null); setTab('manual'); }
  }, [open]);

  const sendAiMessage = async () => {
    if (!aiInput.trim() || aiLoading) return;
    const userMsg: AiMessage = { role: 'user', content: aiInput.trim() };
    const newMsgs = [...aiMessages, userMsg];
    setAiMessages(newMsgs);
    setAiInput('');
    setAiLoading(true);

    const today = new Date().toISOString().split('T')[0];
    const systemPrompt = `You are a friendly task creation assistant. Your job is to gather information about a task through natural conversation — do NOT generate a task JSON until the user explicitly confirms they are done.

Today's date is ${today}.

Rules:
1. Start by understanding what the user wants to do. Ask ONE follow-up question at a time if info is missing.
2. Required info to collect: task title, date. Optional but useful: description, start/end time, priority (low/medium/high/urgent), category, notes.
3. Once you have at least a title and date, summarize what you've gathered and ask: "Does this look correct? Should I fill in the form?"
4. ONLY output the JSON block after the user says yes/correct/looks good/fill it/confirm or similar confirmation.
5. Never output JSON without user confirmation.
6. Keep replies short and conversational. No bullet lists unless summarizing.
7. If the user changes something, update your understanding and re-confirm before outputting JSON.

When the user confirms, output ONLY this JSON block (no extra text after it):
\`\`\`json
{
  "title": "...",
  "description": "...",
  "scheduled_date": "YYYY-MM-DD",
  "start_time": "HH:MM",
  "end_time": "HH:MM",
  "priority": "low|medium|high|urgent",
  "category": "...",
  "notes": "...",
  "youtube_links": []
}
\`\`\``;

    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMsgs, systemPrompt }),
      });
      if (!resp.ok || !resp.body) throw new Error('Stream failed');

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let assistantContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf('\n')) !== -1) {
          let line = buffer.slice(0, idx);
          buffer = buffer.slice(idx + 1);
          if (line.endsWith('\r')) line = line.slice(0, -1);
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (json === '[DONE]') break;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              assistantContent += content;
              setAiMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
            }
          } catch {}
        }
      }

      // Persist to DB
      if (user) {
        let convId = aiConvId;
        if (!convId) {
          const { data: conv } = await supabase
            .from('chat_conversations')
            .insert({ user_id: user.id, title: `Task AI: ${userMsg.content.slice(0, 40)}` })
            .select('id').single();
          convId = conv?.id ?? null;
          setAiConvId(convId);
        }
        if (convId) {
          await supabase.from('chat_messages').insert([
            { conversation_id: convId, user_id: user.id, role: 'user', content: userMsg.content },
            { conversation_id: convId, user_id: user.id, role: 'assistant', content: assistantContent },
          ]);
        }
      }

      // Auto-fill form if JSON task found
      const match = assistantContent.match(/```json\n?([\s\S]*?)\n?```/);
      if (match) {
        try {
          const t = JSON.parse(match[1]);
          if (t.title) {
            setForm(f => ({
              ...f,
              title: t.title || f.title,
              description: t.description || f.description,
              scheduled_date: t.scheduled_date || f.scheduled_date,
              start_time: t.start_time || f.start_time,
              end_time: t.end_time || f.end_time,
              priority: t.priority || f.priority,
              category: t.category || f.category,
              notes: t.notes || f.notes,
              youtube_links: Array.isArray(t.youtube_links) ? t.youtube_links.join('\n') : f.youtube_links,
            }));
          }
        } catch {}
      }
    } catch (err: any) {
      setAiMessages(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}` }]);
    } finally {
      setAiLoading(false);
    }
  };

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

        {/* Tab switcher — only for create mode */}
        {!editTask && (
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            <button
              type="button"
              onClick={() => setTab('manual')}
              className={cn('flex-1 text-xs py-1.5 rounded-md transition-colors font-medium', tab === 'manual' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              Manual
            </button>
            <button
              type="button"
              onClick={() => setTab('ai')}
              className={cn('flex-1 text-xs py-1.5 rounded-md transition-colors font-medium flex items-center justify-center gap-1', tab === 'ai' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              <Sparkles className="w-3 h-3" />AI Plan
            </button>
          </div>
        )}

        {/* AI Chat panel */}
        {tab === 'ai' && (
          <div className="flex flex-col gap-2">
            <div ref={scrollRef} className="h-56 overflow-y-auto space-y-2 p-2 bg-muted/30 rounded-lg">
              {aiMessages.length === 0 && (
                <p className="text-xs text-muted-foreground text-center mt-6">Tell me what you want to do — I'll ask a few questions before filling the form.</p>
              )}
              {aiMessages.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
                  <div className={cn('max-w-[85%] rounded-xl px-3 py-2 text-xs', m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-background border border-border')}>
                    {m.role === 'assistant'
                      ? <div className="prose prose-xs dark:prose-invert max-w-none"><ReactMarkdown>{m.content}</ReactMarkdown></div>
                      : m.content}
                  </div>
                </div>
              ))}
              {aiLoading && aiMessages[aiMessages.length - 1]?.role !== 'assistant' && (
                <div className="flex justify-start"><div className="bg-background border border-border rounded-xl px-3 py-2"><Loader2 className="w-3 h-3 animate-spin text-primary" /></div></div>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); sendAiMessage(); } }}
                placeholder="e.g. I want to study Maths tomorrow"
                className="text-xs"
              />
              <Button type="button" size="icon" onClick={sendAiMessage} disabled={!aiInput.trim() || aiLoading} className="gradient-primary text-primary-foreground shrink-0">
                <Send className="w-3 h-3" />
              </Button>
            </div>
            {form.title && (
              <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg border border-primary/20">
                <Check className="w-3 h-3 text-primary shrink-0" />
                <span className="text-xs flex-1 truncate">Form filled: <strong>{form.title}</strong></span>
                <Button type="button" size="sm" className="h-6 text-[10px] gradient-primary text-primary-foreground" onClick={() => setTab('manual')}>Review & Submit</Button>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className={cn('space-y-4', tab === 'ai' && 'hidden')}>
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
