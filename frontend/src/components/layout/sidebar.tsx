'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  FileText,
  AlertTriangle,
  BarChart3,
  Settings,
  Users,
  ShieldCheck,
  BookOpen,
  MessageSquare,
  Satellite,
  Globe,
  Bot,
  X,
  ChevronLeft,
} from 'lucide-react';
import { useUiStore } from '@/lib/store';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/dashboard/requests', label: 'Billing Requests', icon: FileText },
  { href: '/dashboard/messenger', label: 'Messenger', icon: MessageSquare },
  { href: '/dashboard/customers', label: 'Customers', icon: Users },
  { href: '/dashboard/starlink-accounts', label: 'Starlink Accounts', icon: Satellite },
  { href: '/dashboard/region-plan', label: 'Regions & Plans', icon: Globe },
  { href: '/dashboard/manual-review', label: 'Manual Review', icon: AlertTriangle },
  { href: '/dashboard/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/playground', label: 'Playground', icon: Bot },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ currentPath, isOpen, onClose }: { currentPath: string; isOpen: boolean; onClose: () => void }) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}
      <aside className={cn(
        'fixed lg:static inset-y-0 left-0 z-50 bg-card border-r border-card flex flex-col transition-all duration-200 lg:translate-x-0',
        collapsed ? 'w-16' : 'w-64',
        isOpen ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className={cn('flex items-center p-4 border-b border-card', collapsed ? 'justify-center' : 'justify-between')}>
          {collapsed ? (
            <ShieldCheck className="w-7 h-7 text-primary-600 shrink-0" />
          ) : (
            <>
              <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
                <ShieldCheck className="w-8 h-8 text-primary-600 shrink-0" />
                <div className="min-w-0">
                  <h1 className="font-bold text-foreground text-sm truncate">Billing Assistance</h1>
                  <p className="text-xs text-foreground opacity-50 truncate">Admin Dashboard</p>
                </div>
              </Link>
              <button onClick={onClose} className="p-1.5 hover:bg-card-hover rounded-lg lg:hidden shrink-0" aria-label="Close sidebar">
                <X className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          className="hidden lg:flex items-center justify-center w-full py-2 border-b border-card text-foreground opacity-40 hover:text-foreground hover:bg-card-hover transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeft className={cn('w-4 h-4 transition-transform', collapsed && 'rotate-180')} />
        </button>
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = item.exact ? currentPath === item.href : currentPath.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className={cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                  collapsed ? 'justify-center' : '',
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-foreground opacity-60 hover:bg-card-hover hover:text-foreground',
                )}
                title={collapsed ? item.label : undefined}
              >
                <Icon className="w-5 h-5 shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>
        <div className={cn('p-4 border-t border-card', collapsed && 'text-center')}>
          <p className={cn('text-xs text-foreground opacity-40', collapsed ? 'hidden' : 'text-center')}>
            Independent Third-Party Service
          </p>
        </div>
      </aside>
    </>
  );
}
