import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Send, Sparkles, Loader2, Check, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { useTasks } from '@/hooks/useTasks';
import { cn } from '@/lib/utils';

interface Message { role: 'user' | 'assistant'; content: string; }

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
const AUTH = { Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` };
// Days per batch — each batch = BATCH_DAYS days × subjects tasks
const BATCH_DAYS = 10;

async function streamOnce(messages: Message[], systemPrompt?: string): Promise<string> {
  const resp = await fetch(CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...AUTH },
    body: JSON.stringify({ messages, ...(systemPrompt ? { systemPrompt } : {}) }),
  });
  if (!resp.ok || !resp.body) throw new Error('Stream failed');
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = '', out = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx: number;
    while ((idx = buf.indexOf('\n')) !== -1) {
      let line = buf.slice(0, idx); buf = buf.slice(idx + 1);
      if (line.endsWith('\r')) line = line.slice(0, -1);
      if (!line.startsWith('data: ')) continue;
      const j = line.slice(6).trim();
      if (j === '[DONE]') break;
      try { const d = JSON.parse(j).choices?.[0]?.delta?.content; if (d) out += d; } catch {}
    }
  }
  return out;
}

function extractJsonArray(text: string): any[] | null {
  // Try fenced block first, then bare array
  const fenced = text.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  const raw = fenced ? fenced[1] : text.trim();
  try {
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end === -1) return null;
    const parsed = JSON.parse(raw.slice(start, end + 1));
    return Array.isArray(parsed) ? parsed : null;
  } catch { return null; }
}

interface PlanMeta { days: number; subjects: string[]; hours: number; tasksPerDay: number; }

function parsePlanRequest(text: string): PlanMeta | null {
  const dayMatch = text.match(/(\d+)\s*[-–]?\s*day/i);
  if (!dayMatch) return null;
  const days = parseInt(dayMatch[1]);
  if (days < 2) return null;

  const hourMatch = text.match(/(\d+)\s*h(?:ours?|\/day)?/i);
  const hours = hourMatch ? parseInt(hourMatch[1]) : 6;

  // Extract named subjects
  const knownSubjects = text.match(/\b(english|math(?:s|ematics)?|quant(?:itative)?|reasoning|gk|general\s*knowledge|computer|science|history|geography|physics|chemistry|biology|hindi|economics|fitness|yoga|running|coding|programming|reading)\b/gi);
  const subjects = knownSubjects
    ? [...new Set(knownSubjects.map(s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()))]
    : [];

  // If no named subjects, try to detect count "5 subjects"
  if (subjects.length === 0) {
    const countMatch = text.match(/(\d+)\s*subjects?/i);
    if (countMatch) {
      const n = parseInt(countMatch[1]);
      for (let i = 1; i <= n; i++) subjects.push(`Subject ${i}`);
    }
  }

  const tasksPerDay = subjects.length > 0 ? subjects.length : 1;
  return { days, subjects, hours, tasksPerDay };
}

function buildBatchPrompt(meta: PlanMeta, batchDayStart: number, batchDayEnd: number, batchDateStart: string, userRequest: string): string {
  const { days, subjects, hours, tasksPerDay } = meta;
  const totalBatchTasks = (batchDayEnd - batchDayStart + 1) * tasksPerDay;

  // Build time slots: distribute hours across subjects by difficulty weight
  // Harder subjects (quant, math, reasoning) get more time
  const hardSubjects = ['quant', 'quantitative', 'maths', 'mathematics', 'reasoning', 'physics', 'chemistry'];
  const slots: { subject: string; duration: number }[] = subjects.map(s => ({
    subject: s,
    duration: hardSubjects.some(h => s.toLowerCase().includes(h)) ? Math.ceil(hours / subjects.length * 1.3) : Math.floor(hours / subjects.length * 0.85),
  }));
  // Build time schedule string
  let t = 9 * 60; // 09:00 in minutes
  const schedule = slots.map(sl => {
    const start = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    t += sl.duration * 60;
    const end = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
    t += 10; // 10 min break
    return `${sl.subject}: ${start}–${end}`;
  }).join(', ');

  const phase = batchDayStart <= days * 0.3 ? 'foundational basics' : batchDayStart <= days * 0.7 ? 'intermediate and deeper topics' : 'revision, mock tests, and hard problems';
  const priority = batchDayStart <= days * 0.3 ? 'medium' : batchDayStart <= days * 0.7 ? 'high' : 'urgent';

  return `Generate EXACTLY ${totalBatchTasks} tasks for days ${batchDayStart}–${batchDayEnd} of a ${days}-day plan.

User request: "${userRequest}"
Subjects: ${subjects.join(', ')}
Hours/day: ${hours}h | Time schedule per day: ${schedule}
Phase: ${phase} | Priority for all tasks in this batch: ${priority}
First date of this batch: ${batchDateStart}

RULES:
- Output ONLY a valid JSON array, no other text
- Exactly ${tasksPerDay} tasks per day (one per subject), ${batchDayEnd - batchDayStart + 1} days = ${totalBatchTasks} tasks total
- Each task has a unique date (increment by 1 day per day group)
- Topics must progress logically: day ${batchDayStart} = early ${phase}, day ${batchDayEnd} = later ${phase}
- title format: "Day {N} — {Subject}: {Specific Topic}"
- description: 1-2 sentences on exactly what to study/do
- Use the exact time slots from the schedule above

Output format (ONLY this, nothing else):
[
  {"title":"...","description":"...","date":"YYYY-MM-DD","start_time":"HH:MM","end_time":"HH:MM","priority":"${priority}","category":"...","youtube_links":[]},
  ...
]`;
}

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ done: number; total: number; tasks: number } | null>(null);
  const [pendingPlan, setPendingPlan] = useState<any[] | null>(null);
  const { user } = useAuth();
  const { createTask } = useTasks();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const pushAssistant = (content: string) =>
    setMessages(prev => {
      const last = prev[prev.length - 1];
      if (last?.role === 'assistant') return prev.map((m, i) => i === prev.length - 1 ? { ...m, content } : m);
      return [...prev, { role: 'assistant', content }];
    });

  const addAssistant = (content: string) =>
    setMessages(prev => [...prev, { role: 'assistant', content }]);

  const persistMessages = async (userContent: string, assistantContent: string, title?: string) => {
    if (!user) return;
    let convId = conversationId;
    if (!convId) {
      const { data } = await supabase
        .from('chat_conversations')
        .insert({ user_id: user.id, title: title || userContent.slice(0, 50) })
        .select('id').single();
      convId = data?.id ?? null;
      setConversationId(convId);
    }
    if (convId) {
      await supabase.from('chat_messages').insert([
        { conversation_id: convId, user_id: user.id, role: 'user', content: userContent },
        { conversation_id: convId, user_id: user.id, role: 'assistant', content: assistantContent },
      ]);
    }
  };

  const generatePlan = async (userMsg: Message, meta: PlanMeta) => {
    const { days, subjects, hours, tasksPerDay } = meta;
    const totalTasks = days * tasksPerDay;
    const batches = Math.ceil(days / BATCH_DAYS);
    const today = new Date();
    const allTasks: any[] = [];

    setBatchProgress({ done: 0, total: batches, tasks: 0 });
    pushAssistant(`⏳ Planning ${days}-day schedule: **${subjects.join(', ')}** — ${hours}h/day, **${tasksPerDay} tasks/day** = **${totalTasks} total tasks**\n\nGenerating batch 1/${batches}...`);

    for (let b = 0; b < batches; b++) {
      const batchDayStart = b * BATCH_DAYS + 1;
      const batchDayEnd = Math.min((b + 1) * BATCH_DAYS, days);
      const batchDate = new Date(today);
      batchDate.setDate(today.getDate() + b * BATCH_DAYS);
      const batchDateStr = batchDate.toISOString().split('T')[0];

      const prompt = buildBatchPrompt(meta, batchDayStart, batchDayEnd, batchDateStr, userMsg.content);
      const raw = await streamOnce([{ role: 'user', content: prompt }]);
      const tasks = extractJsonArray(raw);
      if (tasks) allTasks.push(...tasks);

      setBatchProgress({ done: b + 1, total: batches, tasks: allTasks.length });
      pushAssistant(`⏳ Batch ${b + 1}/${batches} done — **${allTasks.length}** tasks generated so far...`);
    }

    setBatchProgress(null);

    // Pick 3 random sample tasks to show in chat for verification
    const sampleIndices = [0, Math.floor(allTasks.length / 2), allTasks.length - 1].filter(i => allTasks[i]);
    const samples = sampleIndices.map(i => allTasks[i]);
    const sampleJson = JSON.stringify(samples, null, 2);

    const summary = `✅ **${allTasks.length} tasks generated** for your ${days}-day plan (${tasksPerDay} tasks/day × ${days} days).

**Sample tasks to verify (Day 1, Day ${Math.floor(days / 2)}, Day ${days}):**
\`\`\`json
${sampleJson}
\`\`\`

Does the structure look correct? Accept below to add all ${allTasks.length} tasks, or tell me what to change.`;

    addAssistant(summary);
    setPendingPlan(allTasks);
    await persistMessages(userMsg.content, summary, `${days}-day plan`);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const meta = parsePlanRequest(userMsg.content);

      if (meta) {
        await generatePlan(userMsg, meta);
      } else {
        // Normal conversational response
        const resp = await fetch(CHAT_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...AUTH },
          body: JSON.stringify({ messages: newMessages }),
        });
        if (resp.status === 429) { toast({ title: 'Rate limited', description: 'Try again in a moment.', variant: 'destructive' }); return; }
        if (resp.status === 402) { toast({ title: 'Credits needed', variant: 'destructive' }); return; }
        if (!resp.ok || !resp.body) throw new Error('Failed to stream');

        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buf = '', assistantContent = '';
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buf.indexOf('\n')) !== -1) {
            let line = buf.slice(0, idx); buf = buf.slice(idx + 1);
            if (line.endsWith('\r')) line = line.slice(0, -1);
            if (!line.startsWith('data: ')) continue;
            const j = line.slice(6).trim();
            if (j === '[DONE]') break;
            try {
              const d = JSON.parse(j).choices?.[0]?.delta?.content;
              if (d) { assistantContent += d; pushAssistant(assistantContent); }
            } catch {}
          }
        }
        const tasks = extractJsonArray(assistantContent);
        if (tasks) setPendingPlan(tasks);
        await persistMessages(userMsg.content, assistantContent);
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
      setBatchProgress(null);
    }
  };

  const acceptPlan = () => {
    if (!pendingPlan) return;
    pendingPlan.forEach((task: any) => {
      createTask.mutate({
        title: task.title || 'Untitled',
        description: task.description || null,
        scheduled_date: task.date || new Date().toISOString().split('T')[0],
        start_time: task.start_time || null,
        end_time: task.end_time || null,
        priority: task.priority || 'medium',
        category: task.category || null,
        youtube_links: task.youtube_links || [],
      });
    });
    toast({ title: `${pendingPlan.length} tasks added!` });
    setPendingPlan(null);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="border-b border-border p-4">
        <h1 className="text-lg font-bold flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          AI Planner Chat
        </h1>
        <p className="text-xs text-muted-foreground">Describe your goal — get a structured plan. Review & refine before accepting.</p>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">What do you want to plan?</h2>
              <p className="text-sm text-muted-foreground max-w-md mt-1">
                e.g. "90-day IBPS Clerk plan, 8h/day, subjects: English, GK, Quant, Reasoning, Computer"
              </p>
            </div>
            <div className="flex flex-wrap gap-2 max-w-lg justify-center">
              {[
                '90-day IBPS Clerk, 8h/day, English GK Quant Reasoning Computer',
                '30-day fitness plan, 2h/day, Running Yoga Strength',
                '7-day sprint, 6h/day, Coding Design Testing',
                '180-day SSC CGL, 6h/day, English Maths Reasoning GK',
              ].map(s => (
                <button key={s} onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  className="px-3 py-1.5 rounded-full text-xs border border-border hover:bg-muted transition-colors text-left">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
              <div className={cn('max-w-[85%] rounded-2xl px-4 py-3 text-sm',
                msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-md' : 'glass-card rounded-bl-md')}>
                {msg.role === 'assistant'
                  ? <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                  : msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && (
          <div className="flex justify-start">
            <div className="glass-card rounded-2xl rounded-bl-md px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              {batchProgress && (
                <span className="text-xs text-muted-foreground">
                  Batch {batchProgress.done}/{batchProgress.total} — {batchProgress.tasks} tasks
                </span>
              )}
            </div>
          </div>
        )}

        {pendingPlan && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="glass-card rounded-xl p-4 border-2 border-primary/30">
            <p className="text-sm font-medium mb-3">
              Ready to add <span className="text-primary font-bold">{pendingPlan.length} tasks</span>. Accept this plan?
            </p>
            <div className="flex gap-2">
              <Button size="sm" onClick={acceptPlan} className="gradient-primary text-primary-foreground">
                <Check className="w-4 h-4 mr-1" />Accept & Add {pendingPlan.length} Tasks
              </Button>
              <Button size="sm" variant="outline" onClick={() => setPendingPlan(null)}>
                <X className="w-4 h-4 mr-1" />Reject
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      <div className="border-t border-border p-4">
        <div className="flex gap-2 max-w-3xl mx-auto">
          <Textarea ref={inputRef} value={input} onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="e.g. 90-day IBPS Clerk plan, 8h/day, English GK Quant Reasoning Computer"
            rows={1} className="resize-none min-h-[44px]" />
          <Button onClick={sendMessage} disabled={!input.trim() || isLoading}
            className="gradient-primary text-primary-foreground shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
