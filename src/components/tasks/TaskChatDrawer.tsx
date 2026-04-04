import { useState, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Task } from '@/hooks/useTasks';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useToast } from '@/hooks/use-toast';
import { Send, Loader2, Bot } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface TaskChatDrawerProps {
  task: Task;
  open: boolean;
  onClose: () => void;
}

export function TaskChatDrawer({ task, open, onClose }: TaskChatDrawerProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load or create conversation for this task
  useEffect(() => {
    if (!open || !user || initialized) return;
    (async () => {
      const { data: existing } = await supabase
        .from('chat_conversations')
        .select('id')
        .eq('task_id', task.id)
        .eq('user_id', user.id)
        .maybeSingle();

      let convId = existing?.id;
      if (!convId) {
        const { data: created } = await supabase
          .from('chat_conversations')
          .insert({ user_id: user.id, task_id: task.id, title: `Task: ${task.title.slice(0, 50)}` })
          .select('id')
          .single();
        convId = created?.id;
      }

      if (convId) {
        setConversationId(convId);
        const { data: msgs } = await supabase
          .from('chat_messages')
          .select('role, content')
          .eq('conversation_id', convId)
          .order('created_at', { ascending: true });
        if (msgs?.length) setMessages(msgs as Message[]);
      }
      setInitialized(true);
    })();
  }, [open, user, task.id, initialized]);

  // Reset when drawer closes
  useEffect(() => {
    if (!open) {
      setInitialized(false);
      setMessages([]);
      setConversationId(null);
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading || !conversationId) return;
    const userMsg: Message = { role: 'user', content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    // Persist user message
    await supabase.from('chat_messages').insert({
      conversation_id: conversationId,
      user_id: user!.id,
      role: 'user',
      content: userMsg.content,
    });

    try {
      const taskContext = `You are an AI assistant helping with a specific task.

Task details:
- Title: ${task.title}
- Description: ${task.description || 'None'}
- Date: ${task.scheduled_date}
- Time: ${task.start_time ? `${task.start_time} – ${task.end_time}` : 'Not set'}
- Priority: ${task.priority}
- Category: ${task.category || 'None'}
- Status: ${task.status}
- Progress: ${task.completion_percentage ?? 0}%

Help the user with questions, tips, resources, or breakdowns related to this task. Be concise and practical.`;

      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: newMessages,
          systemPrompt: taskContext,
        }),
      });

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

      // Persist assistant message
      if (assistantContent) {
        await supabase.from('chat_messages').insert({
          conversation_id: conversationId,
          user_id: user!.id,
          role: 'assistant',
          content: assistantContent,
        });
      }
    } catch (err: any) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col p-0">
        <SheetHeader className="p-4 border-b border-border">
          <SheetTitle className="flex items-center gap-2 text-sm">
            <Bot className="w-4 h-4 text-primary" />
            <span className="truncate">AI Chat — {task.title}</span>
          </SheetTitle>
        </SheetHeader>

        <div ref={scrollRef} className="flex-1 overflow-auto p-4 space-y-3">
          {messages.length === 0 && initialized && (
            <p className="text-xs text-muted-foreground text-center mt-8">
              Ask anything about this task — tips, resources, how to break it down, etc.
            </p>
          )}
          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}
              >
                <div className={cn(
                  'max-w-[85%] rounded-2xl px-3 py-2 text-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-md'
                    : 'bg-muted rounded-bl-md'
                )}>
                  {msg.role === 'assistant'
                    ? <div className="prose prose-sm dark:prose-invert max-w-none"><ReactMarkdown>{msg.content}</ReactMarkdown></div>
                    : msg.content}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {isLoading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl rounded-bl-md px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border">
          <div className="flex gap-2">
            <Textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about this task..."
              rows={1}
              className="resize-none min-h-[40px] text-sm"
            />
            <Button
              onClick={sendMessage}
              disabled={!input.trim() || isLoading || !conversationId}
              size="icon"
              className="gradient-primary text-primary-foreground shrink-0"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
