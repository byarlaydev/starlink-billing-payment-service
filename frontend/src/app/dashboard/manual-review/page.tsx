'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, getConfidenceColor } from '@/lib/utils';
import { AlertTriangle, Eye, CheckCircle, XCircle } from 'lucide-react';

export default function ManualReviewPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    const fetchQueue = async () => {
      try {
        const res = await api.get('/ocr/manual-review', { params: { page, limit: 20 } });
        setItems(res.data.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchQueue();
  }, [page]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-6 h-6 text-orange-500" />
        <h1 className="text-2xl font-bold text-gray-900">Manual Review Queue</h1>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Confidence</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Extracted Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Transaction ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No items in review queue</td></tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-primary-600">
                    {item.paymentProof?.billingRequest?.requestId}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {item.paymentProof?.billingRequest?.fullName}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-sm font-medium ${getConfidenceColor(item.confidenceScore)}`}>
                      {Math.round(item.confidenceScore * 100)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {item.amountPaid ? formatCurrency(item.amountPaid) : 'N/A'}
                  </td>
                  <td className="px-4 py-3 text-sm font-mono">{item.transactionId || 'N/A'}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(item.processedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <button className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded">
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
