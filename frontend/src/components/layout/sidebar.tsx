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
} from 'lucide-react';

const navItems = [
  { href: '/dashboard/requests', label: 'Billing Requests', icon: FileText },
  { href: '/dashboard/customers', label: 'Customers', icon: Users },
  { href: '/dashboard/manual-review', label: 'Manual Review', icon: AlertTriangle },
  { href: '/dashboard/knowledge-base', label: 'Knowledge Base', icon: BookOpen },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/dashboard/settings', label: 'Settings', icon: Settings },
];

export function Sidebar({ currentPath }: { currentPath: string }) {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-8 h-8 text-primary-600" />
          <div>
            <h1 className="font-bold text-gray-900 text-sm">Billing Assistance</h1>
            <p className="text-xs text-gray-500">Admin Dashboard</p>
          </div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary-50 text-primary-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900',
              )}
            >
              <Icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-gray-200">
        <p className="text-xs text-gray-400 text-center">
          Independent Third-Party Service
        </p>
      </div>
    </aside>
  );
}
