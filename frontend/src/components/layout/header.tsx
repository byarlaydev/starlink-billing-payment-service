'use client';

import { useAuthStore, useUiStore } from '@/lib/store';
import { useRouter, usePathname } from 'next/navigation';
import { LogOut, Bell, Menu, Moon, Sun } from 'lucide-react';

const pageTitles: Record<string, string> = {
  '/dashboard': 'Overview',
  '/dashboard/requests': 'Billing Requests',
  '/dashboard/messenger': 'Messenger',
  '/dashboard/customers': 'Customers',
  '/dashboard/starlink-accounts': 'Starlink Accounts',
  '/dashboard/region-plan': 'Regions & Plans',
  '/dashboard/manual-review': 'Manual Review',
  '/dashboard/knowledge-base': 'Knowledge Base',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/playground': 'Playground',
  '/dashboard/settings': 'Settings',
};

export function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const pathname = usePathname();
  const darkMode = useUiStore((s) => s.darkMode);
  const toggleDarkMode = useUiStore((s) => s.toggleDarkMode);

  const handleLogout = () => {
    logout();
    router.push('/login');
  };

  const title = Object.entries(pageTitles).find(([path]) => pathname.startsWith(path))?.[1] || 'Dashboard';

  return (
    <header className="h-16 bg-card border-b border-card flex items-center justify-between px-4 lg:px-6">
      <div className="flex items-center gap-3">
        <button onClick={onMenuClick} className="p-1.5 text-foreground opacity-50 hover:text-foreground hover:bg-card-hover rounded-lg lg:hidden" aria-label="Toggle sidebar">
          <Menu className="w-5 h-5" />
        </button>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
      </div>
      <div className="flex items-center gap-4">
        <button onClick={toggleDarkMode} className="p-2 text-foreground opacity-50 hover:text-foreground hover:bg-card-hover rounded-lg" title={darkMode ? 'Light mode' : 'Dark mode'} aria-label="Toggle dark mode">
          {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>
        <button className="relative p-2 text-foreground opacity-50 hover:text-foreground hover:bg-card-hover rounded-lg">
          <Bell className="w-5 h-5" />
        </button>
        <div className="flex items-center gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium text-foreground">{user?.fullName}</p>
            <p className="text-xs text-foreground opacity-50">{user?.role}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-foreground opacity-50 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
