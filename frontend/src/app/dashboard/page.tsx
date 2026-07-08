'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatDate, cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/error-utils';
import { toast } from 'sonner';
import {
  BarChart3,
  Users,
  Satellite,
  Globe,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  MessageSquare,
  ArrowRight,
  Loader2,
  RefreshCw,
  TrendingUp,
} from 'lucide-react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

interface RecentBilling {
  id: string;
  requestId: string;
  fullName: string;
  billingMonth: string;
  billingAmount: number | null;
  status: string;
  createdAt: string;
}

interface RecentCustomer {
  id: string;
  fullName: string | null;
  facebookName: string | null;
  messengerPsid: string;
  preferredLang: string;
  createdAt: string;
  _count: { conversations: number };
}

const STATUS_COLORS = {
  PENDING: '#EAB308',
  PROCESSING: '#3B82F6',
  APPROVED: '#22C55E',
  COMPLETED: '#16A34A',
  REJECTED: '#EF4444',
  MANUAL_REVIEW: '#F97316',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Pending',
  PROCESSING: 'Processing',
  APPROVED: 'Approved',
  COMPLETED: 'Completed',
  REJECTED: 'Rejected',
  MANUAL_REVIEW: 'Manual Review',
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const [billingStats, setBillingStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [customerCount, setCustomerCount] = useState(0);
  const [accountStats, setAccountStats] = useState<any>(null);
  const [planStats, setPlanStats] = useState<any>(null);
  const [pendingReviews, setPendingReviews] = useState(0);
  const [recentBilling, setRecentBilling] = useState<RecentBilling[]>([]);
  const [recentCustomers, setRecentCustomers] = useState<RecentCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [
          billingRes,
          analyticsRes,
          customersRes,
          accountsRes,
          plansRes,
          pendingRes,
          recentBillingRes,
          recentCustomersRes,
        ] = await Promise.all([
          api.get('/billing/stats'),
          api.get('/billing/analytics'),
          api.get('/customers', { params: { limit: 1 } }),
          api.get('/starlink-accounts/stats'),
          api.get('/region-plan/stats'),
          api.get('/customers/pending-review', { params: { limit: 1 } }),
          api.get('/billing', { params: { limit: 5 } }),
          api.get('/customers', { params: { limit: 5 } }),
        ]);
        setBillingStats(billingRes.data.data);
        setAnalytics(analyticsRes.data.data);
        setCustomerCount(customersRes.data.data.total);
        setAccountStats(accountsRes.data.data);
        setPlanStats(plansRes.data.data);
        setPendingReviews(pendingRes.data.data.total);
        setRecentBilling(recentBillingRes.data.data.data);
        setRecentCustomers(recentCustomersRes.data.data.data);
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const total = billingStats?.total ?? 0;
  const pending = billingStats?.pending ?? 0;
  const completed = billingStats?.completed ?? 0;
  const approved = billingStats?.approved ?? 0;
  const rejected = billingStats?.rejected ?? 0;
  const processing = billingStats?.processing ?? 0;
  const manualReview = billingStats?.manualReview ?? 0;
  const resolved = approved + completed + rejected;

  const pieData = [
    { name: 'Pending', value: pending, color: STATUS_COLORS.PENDING },
    { name: 'Processing', value: processing, color: STATUS_COLORS.PROCESSING },
    { name: 'Approved', value: approved, color: STATUS_COLORS.APPROVED },
    { name: 'Completed', value: completed, color: STATUS_COLORS.COMPLETED },
    { name: 'Rejected', value: rejected, color: STATUS_COLORS.REJECTED },
    { name: 'Manual Review', value: manualReview, color: STATUS_COLORS.MANUAL_REVIEW },
  ].filter(d => d.value > 0);

  const monthlyData = (analytics?.monthlyData || [])
    .map((d: any) => ({
      month: d.billingMonth,
      count: d._count,
      amount: d._sum?.billingAmount ?? 0,
    }))
    .sort((a: any, b: any) => a.month.localeCompare(b.month));

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      PROCESSING: 'bg-blue-100 text-blue-800',
      APPROVED: 'bg-green-100 text-green-800',
      COMPLETED: 'bg-green-100 text-green-800',
      REJECTED: 'bg-red-100 text-red-800',
      MANUAL_REVIEW: 'bg-orange-100 text-orange-800',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
          <p className="font-medium text-gray-900">{label}</p>
          <p className="text-gray-600">{payload[0].value} requests</p>
          {payload[0].payload.amount > 0 && (
            <p className="text-gray-500">${Number(payload[0].payload.amount).toFixed(2)}</p>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-gray-500">
        <Loader2 className="w-5 h-5 mr-2 animate-spin" />
        Loading dashboard...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            Welcome back{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
        <Link
          href="/dashboard/requests"
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
        >
          <FileText className="w-4 h-4" />
          New Billing Request
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: 'Total Requests', value: total, sub: `${resolved}/${total} resolved`,
            href: '/dashboard/requests', icon: FileText, color: 'bg-blue-50 text-blue-600',
            progress: total ? Math.round((resolved / total) * 100) : 0,
          },
          {
            label: 'Customers', value: customerCount,
            sub: `${pendingReviews} pending review`,
            href: '/dashboard/customers', icon: Users, color: 'bg-green-50 text-green-600',
          },
          {
            label: 'Starlink Accounts', value: accountStats?.total ?? 0,
            sub: `${accountStats?.total ?? 0} registered`,
            href: '/dashboard/starlink-accounts', icon: Satellite, color: 'bg-purple-50 text-purple-600',
          },
          {
            label: 'Regions & Plans', value: planStats?.total ?? 0,
            sub: `${planStats?.active ?? 0} active`,
            href: '/dashboard/region-plan', icon: Globe, color: 'bg-orange-50 text-orange-600',
          },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <Link
              key={card.label}
              href={card.href}
              className="relative bg-white rounded-xl border border-gray-200 p-5 hover:shadow-lg transition-all overflow-hidden group"
            >
              <div className={`absolute top-0 right-0 w-24 h-24 ${card.color.replace('text', 'bg').replace('600', '50')} rounded-bl-full -mr-8 -mt-8 group-hover:bg-opacity-80 transition-colors`} />
              <div className="relative">
                <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
                <p className="text-sm text-gray-500 mt-0.5">{card.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{card.sub}</p>
                {'progress' in card && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${card.progress}%` }} />
                    </div>
                  </div>
                )}
              </div>
            </Link>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Status Donut Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Request Status</h2>
          {pieData.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No data</p>
          ) : (
            <div className="flex items-center gap-4">
              <div className="w-36 h-36 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={32}
                      outerRadius={58}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5">
                {pieData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-gray-600">{item.name}</span>
                    </div>
                    <span className="font-medium text-gray-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { label: 'New Billing Request', href: '/dashboard/requests', icon: FileText, desc: 'Create a billing request' },
              { label: 'Messenger', href: '/dashboard/messenger', icon: MessageSquare, desc: 'Chat with customers' },
              { label: 'Manual Review', href: '/dashboard/manual-review', icon: AlertTriangle, desc: `${manualReview} items to review` },
              { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, desc: 'View reports and trends' },
              { label: 'Knowledge Base', href: '/dashboard/knowledge-base', icon: TrendingUp, desc: 'Manage AI knowledge' },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{action.label}</p>
                    <p className="text-xs text-gray-500">{action.desc}</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-primary-600 transition-colors shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Today's Overview */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-900 mb-4">Today's Overview</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <Clock className="w-5 h-5 text-blue-600" />
              <div>
                <p className="text-xs text-blue-600 font-medium">Pending Requests</p>
                <p className="text-lg font-bold text-blue-700">{pending}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-green-50 rounded-lg">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-xs text-green-600 font-medium">Completed Today</p>
                <p className="text-lg font-bold text-green-700">{completed}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 p-3 bg-orange-50 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <div>
                <p className="text-xs text-orange-600 font-medium">Needs Attention</p>
                <p className="text-lg font-bold text-orange-700">{manualReview + pendingReviews}</p>
              </div>
            </div>
            <div className="pt-2">
              <Link
                href="/dashboard/analytics"
                className="flex items-center justify-center gap-1 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                View full analytics
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Trend Chart */}
      {monthlyData.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-900">Monthly Billing Trend</h2>
            <Link
              href="/dashboard/analytics"
              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              View details
            </Link>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
                  {monthlyData.map((_: any, i: number) => (
                    <Cell key={i} fill={i === monthlyData.length - 1 ? '#6366F1' : '#C7D2FE'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Bottom Row: Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Recent Billing Requests</h2>
            <Link href="/dashboard/requests" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
              View all
            </Link>
          </div>
          {recentBilling.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No billing requests yet</p>
          ) : (
            <div className="space-y-2">
              {recentBilling.map((req) => (
                <Link
                  key={req.id}
                  href="/dashboard/requests"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{req.fullName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-500">{req.billingMonth}</span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-gray-500">{formatDate(req.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    {req.billingAmount != null && (
                      <span className="text-sm font-medium text-gray-900">${Number(req.billingAmount).toFixed(2)}</span>
                    )}
                    <span className={cn('px-2 py-0.5 rounded text-[10px] font-medium', getStatusBadge(req.status))}>
                      {req.status.replace('_', ' ')}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-900">Recent Customers</h2>
            <Link href="/dashboard/customers" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
              View all
            </Link>
          </div>
          {recentCustomers.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No customers yet</p>
          ) : (
            <div className="space-y-2">
              {recentCustomers.map((customer) => (
                <Link
                  key={customer.id}
                  href="/dashboard/customers"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center shrink-0 text-sm font-semibold">
                    {(customer.fullName || customer.facebookName || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {customer.fullName || customer.facebookName || 'Unknown'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-gray-500">
                      <span className="truncate">{customer.messengerPsid}</span>
                      <span className="text-gray-300">·</span>
                      <span>{customer._count.conversations} messages</span>
                      <span className="text-gray-300">·</span>
                      <span className="uppercase">{customer.preferredLang}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300 shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
