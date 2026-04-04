import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { LayoutDashboard, Users, ShieldCheck, LogOut, Sparkles, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { icon: LayoutDashboard, label: 'Overview', path: '/admin' },
  { icon: Users,           label: 'Users',    path: '/admin/users' },
];

const superAdminItems = [
  { icon: ShieldCheck, label: 'Admins', path: '/admin/admins' },
];

export function AdminSidebar() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, role, signOut } = useAuth();

  const items = role === 'super_admin' ? [...navItems, ...superAdminItems] : navItems;

  return (
    <aside className="w-60 h-screen bg-sidebar border-r border-sidebar-border flex flex-col shrink-0">
      <div className="p-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg gradient-primary flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <p className="text-xs font-bold text-sidebar-primary-foreground">Admin Panel</p>
            <p className="text-[10px] text-sidebar-foreground capitalize">{role?.replace('_', ' ')}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-0.5">
        {items.map(item => {
          const active = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={cn(
                'w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-all',
                active
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground'
              )}
            >
              <span className="flex items-center gap-2.5">
                <item.icon className="w-4 h-4" />
                {item.label}
              </span>
              {active && <ChevronRight className="w-3 h-3" />}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-sidebar-border space-y-1">
        <button
          onClick={() => navigate('/')}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-sidebar-foreground hover:bg-sidebar-accent/50 transition-colors"
        >
          <Sparkles className="w-3.5 h-3.5" />
          Back to App
        </button>
        <div className="flex items-center justify-between px-3 py-1.5">
          <span className="text-[10px] text-sidebar-foreground truncate max-w-[140px]">{user?.email}</span>
          <button onClick={signOut} className="text-sidebar-foreground hover:text-destructive transition-colors">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
