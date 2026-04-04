import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';
import { useAutoReschedule } from '@/hooks/useAutoReschedule';

export function AppLayout() {
  useAutoReschedule();
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
