'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { BarChart3, TrendingUp, CheckCircle, XCircle, Clock, AlertTriangle, RefreshCw, Loader2, Download } from 'lucide-react';
import { exportCsv } from '@/lib/csv-export';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error-utils';
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

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>(null);
  const [analytics, setAnalytics] = useState<any>(null);
  const [ocrDistribution, setOcrDistribution] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [statsRes, analyticsRes, ocrRes] = await Promise.all([
          api.get('/billing/stats'),
          api.get('/billing/analytics'),
          api.get('/ocr/confidence-distribution'),
        ]);
        setStats(statsRes.data.data);
        setAnalytics(analyticsRes.data.data);
        setOcrDistribution(ocrRes.data.data);
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const [statsRes, analyticsRes, ocrRes] = await Promise.all([
        api.get('/billing/stats'),
        api.get('/billing/analytics'),
        api.get('/ocr/confidence-distribution'),
      ]);
      setStats(statsRes.data.data);
      setAnalytics(analyticsRes.data.data);
      setOcrDistribution(ocrRes.data.data);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  if (loading) return (
    <div className="text-center py-12 text-foreground opacity-50">
      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" />
      <span>Loading analytics...</span>
    </div>
  );

  const statCards = [
    { label: 'Total Requests', value: stats?.total || 0, icon: BarChart3, color: 'bg-blue-50 text-blue-600' },
    { label: 'Pending', value: stats?.pending || 0, icon: Clock, color: 'bg-yellow-50 text-yellow-600' },
    { label: 'Approved', value: stats?.approved || 0, icon: CheckCircle, color: 'bg-green-50 text-green-600' },
    { label: 'Rejected', value: stats?.rejected || 0, icon: XCircle, color: 'bg-red-50 text-red-600' },
    { label: 'Manual Review', value: stats?.manualReview || 0, icon: AlertTriangle, color: 'bg-orange-50 text-orange-600' },
    { label: 'Processing', value: stats?.processing || 0, icon: TrendingUp, color: 'bg-purple-50 text-purple-600' },
  ];

  const monthlyChartData = (analytics?.monthlyData || [])
    .map((d: any) => ({ month: d.billingMonth, count: d._count, amount: d._sum?.billingAmount || 0 }))
    .sort((a: any, b: any) => a.month.localeCompare(b.month));

  const statusColors: Record<string, string> = {
    PENDING: '#EAB308', PROCESSING: '#3B82F6', APPROVED: '#22C55E',
    COMPLETED: '#16A34A', REJECTED: '#EF4444', MANUAL_REVIEW: '#F97316',
  };

  const statusChartData = (analytics?.statusDistribution || []).map((d: any) => ({
    name: d.status, value: d._count, color: statusColors[d.status] || '#9CA3AF',
  }));

  const ocrChartData = ocrDistribution.map((d: any) => ({ name: d.confidenceLevel, value: d._count }));

  const handleExportCsv = () => {
    const monthlyRows = (analytics?.monthlyData || []).map((d: any) => ({
      Month: d.billingMonth,
      Requests: d._count,
      'Total Amount': d._sum?.billingAmount || 0,
    }));
    const statusRows = (analytics?.statusDistribution || []).map((d: any) => ({
      Status: d.status,
      Count: d._count,
    }));
    const allRows = [
      ...(monthlyRows.length ? [{}, ...monthlyRows] : []),
      ...(statusRows.length ? [{}, ...statusRows] : []),
    ];
    if (allRows.length) {
      exportCsv(allRows, `analytics-${new Date().toISOString().slice(0, 10)}`);
      toast.success('CSV exported');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCsv} className="p-2 text-foreground opacity-50 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Export CSV">
            <Download className="w-5 h-5" />
          </button>
          <button onClick={handleRefresh} className="p-2 text-foreground opacity-50 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Refresh">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-card rounded-xl border border-card-border p-4">
              <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
              <p className="text-xs text-foreground opacity-50 mt-1">{card.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Billing Bar Chart */}
        <div className="bg-card rounded-xl border border-card-border p-6">
          <h2 className="text-lg font-semibold mb-4">Monthly Billing Summary</h2>
          {monthlyChartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48} fill="#6366F1" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-foreground opacity-50 text-sm">No data available</p>
          )}
        </div>

        {/* Status Distribution Pie Chart */}
        <div className="bg-card rounded-xl border border-card-border p-6">
          <h2 className="text-lg font-semibold mb-4">Status Distribution</h2>
          {statusChartData.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="w-40 h-40 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={statusChartData} cx="50%" cy="50%" innerRadius={35} outerRadius={60} paddingAngle={2} dataKey="value">
                      {statusChartData.map((entry: any, i: number) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5">
                {statusChartData.map((item: any) => (
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
          ) : (
            <p className="text-foreground opacity-50 text-sm">No data available</p>
          )}
        </div>

        {/* OCR Confidence Bar Chart */}
        <div className="bg-card rounded-xl border border-card-border p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold mb-4">OCR Confidence Distribution</h2>
          {ocrChartData.length > 0 ? (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ocrChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={48}>
                    {ocrChartData.map((_: any, i: number) => (
                      <Cell key={i} fill={i === 0 ? '#22C55E' : i === 1 ? '#EAB308' : '#EF4444'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-foreground opacity-50 text-sm">No OCR data available</p>
          )}
        </div>
      </div>
    </div>
  );
}
