'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { BarChart3, TrendingUp, CheckCircle, XCircle, Clock, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error-utils';

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

  if (loading) return (
    <div className="text-center py-12 text-gray-500">
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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
              <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500 mt-1">{card.label}</p>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Monthly Billing Summary</h2>
          {analytics?.monthlyData?.length > 0 ? (
            <div className="space-y-3">
              {analytics.monthlyData.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm font-medium">{item.billingMonth}</span>
                  <div className="text-right">
                    <p className="text-sm font-bold">{item._count} requests</p>
                    <p className="text-xs text-gray-500">
                      {formatCurrency(item._sum.billingAmount || 0)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No data available</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">Status Distribution</h2>
          {analytics?.statusDistribution?.length > 0 ? (
            <div className="space-y-3">
              {analytics.statusDistribution.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm font-medium">{item.status}</span>
                  <span className="text-sm font-bold">{item._count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No data available</p>
          )}
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4">OCR Confidence Distribution</h2>
          {ocrDistribution.length > 0 ? (
            <div className="space-y-3">
              {ocrDistribution.map((item: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <span className="text-sm font-medium">{item.confidenceLevel}</span>
                  <span className="text-sm font-bold">{item._count}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No OCR data available</p>
          )}
        </div>
      </div>
    </div>
  );
}
