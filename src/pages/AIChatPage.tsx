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

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AIChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [pendingPlan, setPendingPlan] = useState<any[] | null>(null);
  const { user } = useAuth();
  const { createTask } = useTasks();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (resp.status === 429) {
        toast({ title: 'Rate limited', description: 'Please try again in a moment.', variant: 'destructive' });
        setIsLoading(false);
        return;
      }
      if (resp.status === 402) {
        toast({ title: 'Credits needed', description: 'Please add funds to continue.', variant: 'destructive' });
        setIsLoading(false);
        return;
      }
      if (!resp.ok || !resp.body) throw new Error('Failed to stream');

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
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last?.role === 'assistant') {
                  return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantContent } : m);
                }
                return [...prev, { role: 'assistant', content: assistantContent }];
              });
            }
          } catch {}
        }
      }

      // Try to parse tasks from AI response
      try {
        const taskMatch = assistantContent.match(/```json\n?([\s\S]*?)\n?```/);
        if (taskMatch) {
          const parsed = JSON.parse(taskMatch[1]);
          if (Array.isArray(parsed)) setPendingPlan(parsed);
        }
      } catch {}

      // Save messages to DB
      if (user) {
        const { data: conv } = await supabase
          .from('chat_conversations')
          .insert({ user_id: user.id, title: messages.length === 0 ? input.trim().slice(0, 50) : 'Chat' })
          .select()
          .single();
        if (conv) {
          const allMsgs = [...newMessages, { role: 'assistant' as const, content: assistantContent }];
          await supabase.from('chat_messages').insert(
            allMsgs.map(m => ({ conversation_id: conv.id, user_id: user!.id, role: m.role, content: m.content }))
          );
        }
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const acceptPlan = () => {
    if (!pendingPlan) return;
    pendingPlan.forEach((task: any) => {
      createTask.mutate({
        title: task.title || task.topic || 'Untitled',
        description: task.description || task.subtopics?.join(', ') || null,
        scheduled_date: task.date || new Date().toISOString().split('T')[0],
        start_time: task.start_time || null,
        end_time: task.end_time || null,
        priority: task.priority || 'medium',
        category: task.category || task.subject || null,
        youtube_links: task.youtube_links || [],
      });
    });
    toast({ title: `${pendingPlan.length} tasks added!` });
    setPendingPlan(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
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
                Try: "Create a 60-day IBPS Clerk study plan, 8h/day, covering English, GK, Quant, Reasoning, Computer"
              </p>
            </div>
            <div className="flex flex-wrap gap-2 max-w-lg justify-center">
              {[
                'IBPS Clerk 60-day study plan',
                '30-day fitness plan',
                'Sprint planning for 2 weeks',
                'Reading 12 books in 3 months',
              ].map(s => (
                <button
                  key={s}
                  onClick={() => { setInput(s); inputRef.current?.focus(); }}
                  className="px-3 py-1.5 rounded-full text-xs border border-border hover:bg-muted transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence>
          {messages.map((msg, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
            >
              <div className={cn(
                'max-w-[80%] rounded-2xl px-4 py-3 text-sm',
                msg.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-md' : 'glass-card rounded-bl-md'
              )}>
                {msg.role === 'assistant' ? (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : msg.content}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
          <div className="flex justify-start">
            <div className="glass-card rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
            </div>
          </div>
        )}

        {pendingPlan && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-card rounded-xl p-4 border-2 border-primary/30">
            <p className="text-sm font-medium mb-3">AI generated {pendingPlan.length} tasks. Accept this plan?</p>
            <div className="flex gap-2">
              <Button size="sm" onClick={acceptPlan} className="gradient-primary text-primary-foreground">
                <Check className="w-4 h-4 mr-1" />Accept & Add Tasks
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
          <Textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your plan or refine the current one..."
            rows={1}
            className="resize-none min-h-[44px]"
          />
          <Button onClick={sendMessage} disabled={!input.trim() || isLoading} className="gradient-primary text-primary-foreground shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
