import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { LayoutDashboard, CalendarDays, ListTodo, MessageSquare, Sparkles, LogOut, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
  { icon: ListTodo, label: 'Tasks', path: '/tasks' },
  { icon: CalendarDays, label: 'Calendar', path: '/calendar' },
  { icon: MessageSquare, label: 'AI Planner', path: '/ai-chat' },
];

export function AppSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signOut, user } = useAuth();

  return (
    <aside className="w-64 h-screen bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
      <div className="p-5 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg gradient-primary flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-sidebar-primary-foreground">AI Todo Planner</h1>
            <p className="text-xs text-sidebar-foreground">Plan smarter</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                isActive
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              )}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-2">
        <button
          onClick={() => navigate('/ai-chat')}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium gradient-primary text-primary-foreground"
        >
          <Plus className="w-4 h-4" />
          New AI Plan
        </button>
        <div className="flex items-center justify-between px-3 py-2">
          <span className="text-xs text-sidebar-foreground truncate max-w-[160px]">{user?.email}</span>
          <button onClick={signOut} className="text-sidebar-foreground hover:text-destructive transition-colors">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
