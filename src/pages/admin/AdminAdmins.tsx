import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShieldCheck, ShieldOff, Search, User } from 'lucide-react';
import { motion } from 'framer-motion';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface AdminRow {
  user_id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  created_at: string;
}

const ROLE_COLORS: Record<string, string> = {
  super_admin: 'bg-red-500/10 text-red-400 border-red-500/30',
  admin:       'bg-purple-500/10 text-purple-400 border-purple-500/30',
  user:        'bg-muted text-muted-foreground',
};

export default function AdminAdmins() {
  const [rows, setRows]     = useState<AdminRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  const fetchAdmins = async () => {
    setLoading(true);
    const { data: roles } = await (supabase
      .from('user_roles' as any)
      .select('user_id, role, created_at')
      .in('role', ['admin', 'super_admin'])
      .order('created_at', { ascending: false }) as any);

    if (!roles?.length) { setRows([]); setLoading(false); return; }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('user_id, full_name, phone')
      .in('user_id', roles.map(r => r.user_id));

    const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.user_id, p]));

    setRows(roles.map(r => ({
      user_id:    r.user_id,
      full_name:  profileMap[r.user_id]?.full_name ?? null,
      phone:      profileMap[r.user_id]?.phone ?? null,
      role:       r.role,
      created_at: r.created_at,
    })));
    setLoading(false);
  };

  useEffect(() => { fetchAdmins(); }, []);

  const changeRole = async (userId: string, newRole: string) => {
    const { error } = await (supabase
      .from('user_roles' as any)
      .update({ role: newRole })
      .eq('user_id', userId) as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: `Role updated to ${newRole.replace('_', ' ')}` });
    fetchAdmins();
  };

  const demoteToUser = async (userId: string) => {
    const { error } = await (supabase
      .from('user_roles' as any)
      .update({ role: 'user' })
      .eq('user_id', userId) as any);
    if (error) { toast({ title: 'Error', description: error.message, variant: 'destructive' }); return; }
    toast({ title: 'Demoted to user' });
    fetchAdmins();
  };

  const filtered = rows.filter(r => {
    const q = search.toLowerCase();
    return !search || r.full_name?.toLowerCase().includes(q) || r.user_id.includes(q);
  });

  return (
    <div className="p-6 lg:p-8 max-w-4xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Admins</h1>
        <p className="text-sm text-muted-foreground">Manage admin and super admin roles</p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input placeholder="Search admins..." value={search}
          onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />)}</div>
      ) : (
        <div className="glass-card rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Admin</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground">Since</th>
                <th className="px-4 py-3 text-xs font-semibold text-muted-foreground text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r, i) => (
                <motion.tr key={r.user_id}
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                  className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{r.full_name || 'Unnamed'}</p>
                        <p className="text-[10px] text-muted-foreground">{r.user_id.slice(0, 16)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Select value={r.role} onValueChange={v => changeRole(r.user_id, v)}>
                      <SelectTrigger className={cn('h-6 text-[10px] w-28 border', ROLE_COLORS[r.role])}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="super_admin">Super Admin</SelectItem>
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {new Date(r.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => demoteToUser(r.user_id)}>
                      <ShieldOff className="w-3 h-3 mr-1" />Demote
                    </Button>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <ShieldCheck className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
              No admins found. Promote users from the Users page.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
