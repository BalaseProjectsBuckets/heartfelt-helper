import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/lib/auth';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Eye, CheckCircle2, Clock, RefreshCw, ListTodo, User, KeyRound, EyeOff } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface UserRow {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  joined_at: string;
  role: string;
  total_tasks: number;
  completed_tasks: number;
  pending_tasks: number;
  rescheduled_tasks: number;
  last_activity: string | null;
}

interface UserTask {
  id: string;
  title: string;
  status: string;
  priority: string;
  scheduled_date: string;
  category: string | null;
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-red-500/10 text-red-400 border-red-500/30',
  admin:       'bg-purple-500/10 text-purple-400 border-purple-500/30',
  user:        'bg-muted text-muted-foreground',
};

const STATUS_COLORS: Record<string, string> = {
  completed:     'text-green-400',
  in_progress:   'text-yellow-400',
  pending:       'text-muted-foreground',
  not_completed: 'text-red-400',
  rescheduled:   'text-blue-400',
};

export default function AdminUsers() {
  const { isSuperAdmin, session } = useAuth();
  const [users, setUsers]         = useState<UserRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedUser, setSelectedUser] = useState<UserRow | null>(null);
  const [userTasks, setUserTasks] = useState<UserTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  // Password reset state
  const [resetUser, setResetUser]     = useState<UserRow | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPwd, setShowPwd]         = useState(false);
  const [resetting, setResetting]     = useState(false);
  const { toast } = useToast();

  const fetchUsers = async () => {
    setLoading(true);
    // Join profiles + user_roles + task counts
    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone, created_at');

    const { data: roles } = await (supabase
      .from('user_roles' as any)
      .select('user_id, role') as any);

    const { data: tasks } = await supabase
      .from('tasks')
      .select('user_id, status');

    if (!profiles) { setLoading(false); return; }

    const roleMap = Object.fromEntries((roles ?? []).map(r => [r.user_id, r.role]));
    const taskMap: Record<string, { total: number; completed: number; pending: number; rescheduled: number }> = {};

    (tasks ?? []).forEach(t => {
      if (!taskMap[t.user_id]) taskMap[t.user_id] = { total: 0, completed: 0, pending: 0, rescheduled: 0 };
      taskMap[t.user_id].total++;
      if (t.status === 'completed')   taskMap[t.user_id].completed++;
      if (t.status === 'pending')     taskMap[t.user_id].pending++;
      if (t.status === 'rescheduled') taskMap[t.user_id].rescheduled++;
    });

    setUsers(profiles.map(p => ({
      user_id:          p.user_id,
      full_name:        p.full_name,
      phone:            p.phone,
      joined_at:        p.created_at,
      role:             roleMap[p.user_id] ?? 'user',
      total_tasks:      taskMap[p.user_id]?.total ?? 0,
      completed_tasks:  taskMap[p.user_id]?.completed ?? 0,
      pending_tasks:    taskMap[p.user_id]?.pending ?? 0,
      rescheduled_tasks: taskMap[p.user_id]?.rescheduled ?? 0,
      last_activity:    null,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []);

  const openUser = async (u: UserRow) => {
    setSelectedUser(u);
    setTasksLoading(true);
    const { data } = await supabase
      .from('tasks')
      .select('id, title, status, priority, scheduled_date, category')
      .eq('user_id', u.user_id)
      .order('scheduled_date', { ascending: false });
    setUserTasks((data as UserTask[]) ?? []);
    setTasksLoading(false);
  };

  const changeRole = async (userId: string, newRole: string) => {
    await supabase.from('user_roles').update({ role: newRole }).eq('user_id', userId);
    fetchUsers();
    if (selectedUser?.user_id === userId) setSelectedUser(prev => prev ? { ...prev, role: newRole } : null);
  };

  const handleResetPassword = async () => {
    if (!resetUser || !newPassword) return;
    setResetting(true);
    try {
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: JSON.stringify({ target_user_id: resetUser.user_id, new_password: newPassword }),
        }
      );
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error);
      toast({ title: `Password updated for ${resetUser.full_name || 'user'}` });
      setResetUser(null);
      setNewPassword('');
    } catch (e: any) {
      toast({ title: 'Error', description: e.message, variant: 'destructive' });
    } finally {
      setResetting(false);
    }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchSearch = !search ||
      u.full_name?.toLowerCase().includes(q) ||
      u.user_id.includes(q) ||
      u.phone?.includes(q);
    const matchRole = roleFilter === 'all' || u.role === roleFilter;
    return matchSearch && matchRole;
  });

  const completionRate = (u: UserRow) =>
    u.total_tasks > 0 ? Math.round((u.completed_tasks / u.total_tasks) * 100) : 0;

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-muted-foreground">{users.length} registered users</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input placeholder="Search by name, phone, ID..." value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger className="w-[130px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Roles</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Tasks</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Progress</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <motion.tr
                  key={u.user_id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{u.full_name || 'Unnamed'}</p>
                        <p className="text-[10px] text-muted-foreground">{u.phone || u.user_id.slice(0, 12) + '...'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {isSuperAdmin ? (
                      <Select value={u.role} onValueChange={v => changeRole(u.user_id, v)}>
                        <SelectTrigger className={cn('h-6 text-[10px] w-28 border', ROLE_COLORS[u.role])}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="user">User</SelectItem>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="super_admin">Super Admin</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline" className={cn('text-[10px]', ROLE_COLORS[u.role])}>
                        {u.role.replace('_', ' ')}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><ListTodo className="w-3 h-3" />{u.total_tasks}</span>
                      <span className="flex items-center gap-1 text-green-400"><CheckCircle2 className="w-3 h-3" />{u.completed_tasks}</span>
                      <span className="flex items-center gap-1 text-blue-400"><RefreshCw className="w-3 h-3" />{u.rescheduled_tasks}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 w-32">
                    <div className="space-y-1">
                      <Progress value={completionRate(u)} className="h-1.5" />
                      <p className="text-[10px] text-muted-foreground">{completionRate(u)}%</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(u.joined_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openUser(u)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7" title="Reset password" onClick={() => { setResetUser(u); setNewPassword(''); setShowPwd(false); }}>
                        <KeyRound className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">No users found</div>
          )}
        </div>
      )}

      {/* Reset password dialog */}
      <Dialog open={!!resetUser} onOpenChange={v => !v && setResetUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-4 h-4" />
              Reset Password
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Set a new password for <span className="font-medium text-foreground">{resetUser?.full_name || 'this user'}</span>
          </p>
          <div className="relative">
            <Input
              type={showPwd ? 'text' : 'password'}
              placeholder="New password (min 6 chars)"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleResetPassword()}
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPwd(p => !p)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" size="sm" onClick={() => setResetUser(null)}>Cancel</Button>
            <Button size="sm" onClick={handleResetPassword}
              disabled={newPassword.length < 6 || resetting}
              className="gradient-primary text-primary-foreground">
              {resetting ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* User detail dialog */}
      <Dialog open={!!selectedUser} onOpenChange={v => !v && setSelectedUser(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-4 h-4" />
              {selectedUser?.full_name || 'Unnamed User'}
              <Badge variant="outline" className={cn('text-[10px] ml-1', ROLE_COLORS[selectedUser?.role ?? 'user'])}>
                {selectedUser?.role?.replace('_', ' ')}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {/* User meta */}
          <div className="grid grid-cols-3 gap-3 py-2">
            {[
              { label: 'Total Tasks',  value: selectedUser?.total_tasks ?? 0,      color: 'text-foreground' },
              { label: 'Completed',    value: selectedUser?.completed_tasks ?? 0,   color: 'text-green-400' },
              { label: 'Rescheduled', value: selectedUser?.rescheduled_tasks ?? 0, color: 'text-blue-400' },
            ].map(s => (
              <div key={s.label} className="glass-card rounded-lg p-3 text-center">
                <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Tasks list */}
          <div>
            <p className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">All Tasks</p>
            {tasksLoading ? (
              <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}</div>
            ) : userTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">No tasks yet</p>
            ) : (
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {userTasks.map(t => {
                  const StatusIcon = t.status === 'completed' ? CheckCircle2 : t.status === 'rescheduled' ? RefreshCw : Clock;
                  return (
                    <div key={t.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40 text-sm">
                      <StatusIcon className={cn('w-3.5 h-3.5 shrink-0', STATUS_COLORS[t.status])} />
                      <span className={cn('flex-1 truncate text-xs', t.status === 'completed' && 'line-through text-muted-foreground')}>
                        {t.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-mono shrink-0">{t.scheduled_date}</span>
                      {t.category && <Badge variant="secondary" className="text-[9px] h-4 px-1 shrink-0">{t.category}</Badge>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
