'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatDate } from '@/lib/utils';
import { getErrorMessage } from '@/lib/error-utils';
import { StatusDialog } from '@/components/ui/status-dialog';
import {
  BarChart3, Users, Satellite, Globe, AlertTriangle, Clock, CheckCircle,
  FileText, MessageSquare, ArrowRight, Loader2,
} from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [billingStats, setBillingStats] = useState<any>(null);
  const [customerCount, setCustomerCount] = useState(0);
  const [accountStats, setAccountStats] = useState<any>(null);
  const [planStats, setPlanStats] = useState<any>(null);
  const [pendingReviews, setPendingReviews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusDialog, setStatusDialog] = useState<{
    open: boolean; type: 'success' | 'error'; title: string; message?: string;
  }>({ open: false, type: 'success', title: '' });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          billingRes,
          customersRes,
          accountsRes,
          plansRes,
          pendingRes,
        ] = await Promise.all([
          api.get('/billing/stats'),
          api.get('/customers', { params: { limit: 1 } }),
          api.get('/starlink-accounts/stats'),
          api.get('/region-plan/stats'),
          api.get('/customers/pending-review', { params: { limit: 1 } }),
        ]);
        setBillingStats(billingRes.data.data);
        setCustomerCount(customersRes.data.data.total);
        setAccountStats(accountsRes.data.data);
        setPlanStats(plansRes.data.data);
        setPendingReviews(pendingRes.data.data.total);
      } catch (err) {
        setStatusDialog({ open: true, type: 'error', title: 'Failed to Load', message: getErrorMessage(err) });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const statCards = [
    {
      label: 'Billing Requests',
      value: billingStats?.total ?? '-',
      sub: `${billingStats?.pending ?? 0} pending`,
      icon: FileText,
      color: 'bg-blue-50 text-blue-600',
      href: '/dashboard/requests',
    },
    {
      label: 'Customers',
      value: customerCount,
      sub: `${pendingReviews} pending review`,
      icon: Users,
      color: 'bg-green-50 text-green-600',
      href: '/dashboard/customers',
    },
    {
      label: 'Starlink Accounts',
      value: accountStats?.total ?? '-',
      sub: `${accountStats?.active ?? 0} active`,
      icon: Satellite,
      color: 'bg-purple-50 text-purple-600',
      href: '/dashboard/starlink-accounts',
    },
    {
      label: 'Regions & Plans',
      value: planStats?.total ?? '-',
      sub: `${planStats?.active ?? 0} active`,
      icon: Globe,
      color: 'bg-orange-50 text-orange-600',
      href: '/dashboard/region-plan',
    },
    {
      label: 'Manual Review',
      value: billingStats?.manualReview ?? '-',
      sub: 'needs attention',
      icon: AlertTriangle,
      color: 'bg-red-50 text-red-600',
      href: '/dashboard/manual-review',
    },
    {
      label: 'Processing',
      value: billingStats?.processing ?? '-',
      sub: 'in progress',
      icon: Clock,
      color: 'bg-yellow-50 text-yellow-600',
      href: '/dashboard/requests',
    },
  ];

  const quickActions = [
    { label: 'New Billing Request', href: '/dashboard/requests', icon: FileText },
    { label: 'Messenger', href: '/dashboard/messenger', icon: MessageSquare },
    { label: 'Pending Review', href: '/dashboard/manual-review', icon: AlertTriangle },
    { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3 },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-500">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome back{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
            </Link>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 p-4 rounded-xl border border-gray-200 hover:border-primary-300 hover:bg-primary-50 transition-all group"
                >
                  <div className="w-10 h-10 rounded-lg bg-primary-100 text-primary-600 flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{action.label}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-primary-600 transition-colors" />
                </Link>
              );
            })}
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Status Overview</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-500" />
                <span className="text-sm text-gray-600">Approved</span>
              </div>
              <span className="text-sm font-semibold">{billingStats?.approved ?? 0}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-yellow-500" />
                <span className="text-sm text-gray-600">Pending</span>
              </div>
              <span className="text-sm font-semibold">{billingStats?.pending ?? 0}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-blue-500" />
                <span className="text-sm text-gray-600">Processing</span>
              </div>
              <span className="text-sm font-semibold">{billingStats?.processing ?? 0}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-blue-600" />
                <span className="text-sm text-gray-600">Completed</span>
              </div>
              <span className="text-sm font-semibold">{billingStats?.completed ?? 0}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <span className="text-sm text-gray-600">Rejected</span>
              </div>
              <span className="text-sm font-semibold">{billingStats?.rejected ?? 0}</span>
            </div>
          </div>
        </div>
      </div>

      <StatusDialog
        open={statusDialog.open}
        type={statusDialog.type}
        title={statusDialog.title}
        message={statusDialog.message}
        onClose={() => setStatusDialog({ ...statusDialog, open: false })}
      />
    </div>
  );
}
