'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, getConfidenceColor } from '@/lib/utils';
import { getErrorMessage } from '@/lib/error-utils';
import { AlertTriangle, Eye, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function ManualReviewPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const limit = 20;

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const res = await api.get('/ocr/manual-review', { params: { page, limit } });
      setItems(res.data.data.data);
      setTotal(res.data.data.total);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQueue(); }, [page]);

  const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      const billingRequestId = items.find(i => i.id === id)?.paymentProof?.billingRequest?.id;
      if (!billingRequestId) {
        toast.error('Could not find billing request');
        return;
      }
      await api.put(`/billing/${billingRequestId}/status`, { status });
      toast.success(`Request ${status === 'APPROVED' ? 'approved' : 'rejected'}`);
      fetchQueue();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <AlertTriangle className="w-6 h-6 text-orange-500" />
        <h1 className="text-2xl font-bold text-gray-900">Manual Review Queue</h1>
        {!loading && <span className="text-sm text-gray-500">{total} items</span>}
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
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <span>Loading review queue...</span>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                  <p className="font-medium">No items in review queue</p>
                  <p className="text-xs mt-1">Items appear here when OCR confidence is low</p>
                </td>
              </tr>
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
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleReview(item.id, 'APPROVED')}
                        className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                        title="Approve"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleReview(item.id, 'REJECTED')}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Reject"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= totalPages}
            className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50 hover:bg-gray-50"
          >
            Next
          </button>
        </div>
      )}

      {selectedItem && (
        <ReviewDetailModal item={selectedItem} onClose={() => setSelectedItem(null)} />
      )}
    </div>
  );
}

function ReviewDetailModal({ item, onClose }: { item: any; onClose: () => void }) {
  const billingRequest = item.paymentProof?.billingRequest;
  const proof = item.paymentProof;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">OCR Result Details</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg text-lg leading-none">✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Request Info</h3>
            <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3">
              <div>
                <p className="text-xs text-gray-500">Request ID</p>
                <p className="text-sm font-mono">{billingRequest?.requestId || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Customer</p>
                <p className="text-sm">{billingRequest?.fullName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Amount</p>
                <p className="text-sm">{billingRequest?.billingAmount ? formatCurrency(billingRequest.billingAmount) : 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Month</p>
                <p className="text-sm">{billingRequest?.billingMonth || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-2">OCR Result</h3>
            <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3">
              <div>
                <p className="text-xs text-gray-500">Confidence</p>
                <p className={`text-sm font-medium ${getConfidenceColor(item.confidenceScore)}`}>
                  {Math.round(item.confidenceScore * 100)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Transaction ID</p>
                <p className="text-sm font-mono">{item.transactionId || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Amount Paid</p>
                <p className="text-sm">{item.amountPaid ? formatCurrency(item.amountPaid) : 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Payment Method</p>
                <p className="text-sm">{item.paymentMethod || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Payment Date</p>
                <p className="text-sm">{item.paymentDate || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Payment Time</p>
                <p className="text-sm">{item.paymentTime || 'N/A'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500">Sender</p>
                <p className="text-sm">{item.senderName || 'N/A'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500">Receiver</p>
                <p className="text-sm">{item.receiverName || 'N/A'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500">Bank/Wallet</p>
                <p className="text-sm">{item.bankWalletName || 'N/A'}</p>
              </div>
            </div>
          </div>

          {item.rawText && (
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Raw OCR Text</h3>
              <pre className="bg-gray-50 rounded-lg p-3 text-xs whitespace-pre-wrap max-h-40 overflow-y-auto">
                {item.rawText}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
