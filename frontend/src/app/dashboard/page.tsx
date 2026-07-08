'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatDate, cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  BarChart3,
  Users,
  Satellite,
  Globe,
  AlertTriangle,
  Clock,
  CheckCircle,
  FileText,
  MessageSquare,
  ArrowRight,
  RefreshCw,
  TrendingUp,
  DollarSign,
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
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSafe = useCallback(async (fn: () => Promise<any>, setter: (v: any) => void) => {
    try { const res = await fn(); setter(res.data.data); } catch { /* silent */ }
  }, []);

  const fetchData = useCallback(async () => {
    await Promise.all([
      fetchSafe(() => api.get('/billing/stats'), setBillingStats),
      fetchSafe(() => api.get('/billing/analytics'), setAnalytics),
      fetchSafe(() => api.get('/customers', { params: { limit: 1 } }).then(r => { setCustomerCount(r.data.data.total); }), () => {}),
      fetchSafe(() => api.get('/starlink-accounts/stats'), setAccountStats),
      fetchSafe(() => api.get('/region-plan/stats'), setPlanStats),
      fetchSafe(() => api.get('/customers/pending-review', { params: { limit: 1 } }).then(r => { setPendingReviews(r.data.data.total); }), () => {}),
      fetchSafe(() => api.get('/billing', { params: { limit: 5 } }).then(r => { setRecentBilling(r.data.data.data); }), () => {}),
      fetchSafe(() => api.get('/customers', { params: { limit: 5 } }).then(r => { setRecentCustomers(r.data.data.data); }), () => {}),
    ]);
    setLastUpdated(new Date());
    setLoading(false);
    setRefreshing(false);
  }, [fetchSafe]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRefreshing(true);
      fetchData();
    }, 30000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchData]);

  useEffect(() => {
    const tick = setInterval(() => {
      if (lastUpdated) setElapsed(Math.floor((Date.now() - lastUpdated.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(tick);
  }, [lastUpdated]);

  const handleRefresh = () => { setRefreshing(true); fetchData(); };

  const total = billingStats?.total ?? 0;
  const pending = billingStats?.pending ?? 0;
  const completed = billingStats?.completed ?? 0;
  const approved = billingStats?.approved ?? 0;
  const rejected = billingStats?.rejected ?? 0;
  const processing = billingStats?.processing ?? 0;
  const manualReview = billingStats?.manualReview ?? 0;
  const resolved = approved + completed + rejected;

  const totalRevenue = (analytics?.monthlyData || [])
    .reduce((sum: number, d: any) => sum + (d._sum?.billingAmount ?? 0), 0);

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
      PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
      PROCESSING: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
      APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      COMPLETED: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
      REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
      MANUAL_REVIEW: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
    };
    return styles[status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300';
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload?.length) {
      return (
        <div className="bg-card border border-card-border rounded-lg shadow-lg px-3 py-2 text-sm">
          <p className="font-medium text-foreground">{label}</p>
          <p className="text-foreground opacity-60">{payload[0].value} requests</p>
          {payload[0].payload.amount > 0 && (
            <p className="text-foreground opacity-50">${Number(payload[0].payload.amount).toFixed(2)}</p>
          )}
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 rounded animate-shimmer" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => (
            <div key={i} className="bg-card border border-card-border rounded-xl p-6">
              <div className="h-4 w-20 rounded animate-shimmer mb-3" />
              <div className="h-8 w-16 rounded animate-shimmer" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Welcome back{user?.fullName ? `, ${user.fullName.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-foreground opacity-50 mt-1">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-foreground opacity-40">{elapsed}s ago</span>
          )}
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-2 text-foreground opacity-40 hover:text-primary-600 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <Link
            href="/dashboard/requests"
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
          >
            <FileText className="w-4 h-4" />
            New Billing Request
          </Link>
        </div>
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
            sub: `${accountStats?.active ?? 0} active · ${accountStats?.primary ?? 0} primary`,
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
              className="relative bg-card border border-card-border rounded-xl p-5 hover:shadow-lg transition-all overflow-hidden group"
            >
              <div className={`absolute top-0 right-0 w-24 h-24 ${card.color.replace('text', 'bg').replace('600', '50')} rounded-bl-full -mr-8 -mt-8 group-hover:bg-opacity-80 transition-colors`} />
              <div className="relative">
                <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                  <Icon className="w-5 h-5" />
                </div>
                <p className="text-2xl font-bold text-foreground">{card.value}</p>
                <p className="text-sm text-foreground opacity-60 mt-0.5">{card.label}</p>
                <p className="text-xs text-foreground opacity-40 mt-0.5">{card.sub}</p>
                {'progress' in card && (
                  <div className="flex items-center gap-2 mt-2">
                    <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
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
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Request Status</h2>
          {pieData.length === 0 ? (
            <p className="text-sm text-foreground opacity-40 text-center py-8">No data</p>
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
                      <span className="text-foreground opacity-60">{item.name}</span>
                    </div>
                    <span className="font-medium text-foreground">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Quick Actions</h2>
          <div className="space-y-2">
            {[
              { label: 'New Billing Request', href: '/dashboard/requests', icon: FileText, desc: 'Create a billing request', count: null },
              { label: 'Messenger', href: '/dashboard/messenger', icon: MessageSquare, desc: 'Chat with customers', count: null },
              { label: 'Manual Review', href: '/dashboard/manual-review', icon: AlertTriangle, desc: 'Items needing review', count: manualReview + pendingReviews },
              { label: 'Analytics', href: '/dashboard/analytics', icon: BarChart3, desc: 'View reports and trends', count: null },
              { label: 'Knowledge Base', href: '/dashboard/knowledge-base', icon: TrendingUp, desc: 'Manage AI knowledge', count: null },
            ].map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-card-hover transition-colors group"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{action.label}</p>
                    <p className="text-xs text-foreground opacity-50">{action.desc}</p>
                  </div>
                  {action.count != null && action.count > 0 && (
                    <span className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 px-2 py-0.5 rounded-full text-xs font-medium">
                      {action.count}
                    </span>
                  )}
                  <ArrowRight className="w-4 h-4 text-foreground opacity-20 group-hover:text-primary-600 transition-colors shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>

        {/* Today's Overview */}
        <div className="bg-card border border-card-border rounded-xl p-5">
          <h2 className="text-sm font-semibold text-foreground mb-4">Today's Overview</h2>
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
            {totalRevenue > 0 && (
              <div className="flex items-center gap-3 p-3 bg-indigo-50 rounded-lg">
                <DollarSign className="w-5 h-5 text-indigo-600" />
                <div>
                  <p className="text-xs text-indigo-600 font-medium">Total Billed (All Time)</p>
                  <p className="text-lg font-bold text-indigo-700">${totalRevenue.toFixed(2)}</p>
                </div>
              </div>
            )}
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
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-foreground">Monthly Billing Trend</h2>
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
        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Recent Billing Requests</h2>
            <Link href="/dashboard/requests" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
              View all
            </Link>
          </div>
          {recentBilling.length === 0 ? (
            <div className="text-center py-8 text-foreground opacity-40">
              <FileText className="w-8 h-8 mx-auto mb-2 text-foreground opacity-20 animate-float" />
              <p className="text-sm">No billing requests yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentBilling.map((req) => (
                <Link
                  key={req.id}
                  href="/dashboard/requests"
                  className="flex items-center justify-between p-3 rounded-lg hover:bg-card-hover transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{req.fullName}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-foreground opacity-50">{req.billingMonth}</span>
                      <span className="text-xs text-foreground opacity-30">·</span>
                      <span className="text-xs text-foreground opacity-50">{formatDate(req.createdAt)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 ml-3">
                    {req.billingAmount != null && (
                      <span className="text-sm font-medium text-foreground">${Number(req.billingAmount).toFixed(2)}</span>
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

        <div className="bg-card border border-card-border rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-foreground">Recent Customers</h2>
            <Link href="/dashboard/customers" className="text-xs text-primary-600 hover:text-primary-700 font-medium">
              View all
            </Link>
          </div>
          {recentCustomers.length === 0 ? (
            <div className="text-center py-8 text-foreground opacity-40">
              <Users className="w-8 h-8 mx-auto mb-2 text-foreground opacity-20 animate-float" />
              <p className="text-sm">No customers yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {recentCustomers.map((customer) => (
                <Link
                  key={customer.id}
                  href="/dashboard/customers"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-card-hover transition-colors"
                >
                  <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-600 flex items-center justify-center shrink-0 text-sm font-semibold">
                    {(customer.fullName || customer.facebookName || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {customer.fullName || customer.facebookName || 'Unknown'}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-foreground opacity-50">
                      <span className="truncate">{customer.messengerPsid}</span>
                      <span className="text-foreground opacity-30">·</span>
                      <span>{customer._count.conversations} messages</span>
                      <span className="text-foreground opacity-30">·</span>
                      <span className="uppercase">{customer.preferredLang}</span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-foreground opacity-20 shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
