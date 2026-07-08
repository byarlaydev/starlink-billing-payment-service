'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, getConfidenceColor } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { getErrorMessage } from '@/lib/error-utils';
import { useModalAnimation } from '@/hooks/useModalAnimation';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { AlertTriangle, Eye, CheckCircle, XCircle, RefreshCw, Loader2, Search, Download, X } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';
import { exportCsv } from '@/lib/csv-export';
import { toast } from 'sonner';

export default function ManualReviewPage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedItem, setSelectedItem] = useState<any | null>(null);
  const modalAnim = useModalAnimation(!!selectedItem, () => setSelectedItem(null));
  const limit = 20;

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit };
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await api.get('/ocr/manual-review', { params });
      setItems(res.data.data.data);
      setTotal(res.data.data.total);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const handleExportCsv = () => {
    exportCsv(
      items.map(item => ({
        Request: item.paymentProof?.billingRequest?.requestId || '',
        Customer: item.paymentProof?.billingRequest?.fullName || '',
        Confidence: item.confidence ? `${(item.confidence * 100).toFixed(0)}%` : '',
        Amount: item.extractedAmount || '',
        'Transaction ID': item.transactionId || '',
        Method: item.paymentMethod || '',
        Sender: item.senderName || '',
        Bank: item.bankName || '',
      })),
      `manual-review-${new Date().toISOString().slice(0, 10)}`,
    );
    toast.success('CSV exported');
  };

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <AlertTriangle className="w-6 h-6 text-orange-500" />
          <h1 className="text-2xl font-bold text-foreground">Manual Review Queue</h1>
          {!loading && <span className="text-sm text-foreground opacity-50">{total} items</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCsv} className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-card-hover text-foreground" title="Export CSV">
            <Download className="w-4 h-4" />
            Export CSV
          </button>
          <button onClick={fetchQueue} className="p-2 text-foreground opacity-50 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Refresh">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-foreground opacity-40" />
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by request ID or customer name..."
          className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div className="bg-card rounded-xl border border-card-border overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-card-border sticky top-0 z-10">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-foreground opacity-50 uppercase">Request</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-foreground opacity-50 uppercase">Customer</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-foreground opacity-50 uppercase">Confidence</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-foreground opacity-50 uppercase">Extracted Amount</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-foreground opacity-50 uppercase">Transaction ID</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-foreground opacity-50 uppercase">Date</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-foreground opacity-50 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-foreground opacity-50">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <span>Loading review queue...</span>
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-foreground opacity-50">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 text-foreground opacity-30 animate-float" />
                  <p className="font-medium">No items in review queue</p>
                  <p className="text-xs mt-1">Items appear here when OCR confidence is low</p>
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="hover:bg-card-hover even:bg-gray-50/40">
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
                  <td className="px-4 py-3 text-sm text-foreground opacity-50">{formatDate(item.processedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => setSelectedItem(item)}
                        className="p-1.5 text-foreground opacity-50 hover:text-primary-600 hover:bg-primary-50 rounded"
                        title="View Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleReview(item.id, 'APPROVED')}
                        className="p-1.5 text-foreground opacity-50 hover:text-green-600 hover:bg-green-50 rounded"
                        title="Approve"
                      >
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleReview(item.id, 'REJECTED')}
                        className="p-1.5 text-foreground opacity-50 hover:text-red-600 hover:bg-red-50 rounded"
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

      <Pagination page={page} total={total} limit={limit} onPageChange={setPage} />

      {modalAnim.visible && (
        <ReviewDetailModal item={selectedItem} onClose={modalAnim.close} />
      )}
    </div>
  );
}

function ReviewDetailModal({ item, onClose }: { item: any; onClose: () => void }) {
  const billingRequest = item.paymentProof?.billingRequest;
  const proof = item.paymentProof;
  const anim = useModalAnimation(true, onClose);
  const focusTrapRef = useFocusTrap(anim.visible);

  return (
    <div ref={focusTrapRef} role="dialog" aria-modal="true" className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 transition-opacity duration-200 ${anim.closing ? 'opacity-0' : 'opacity-100'}`} onClick={anim.close}>
      <div className={`bg-card rounded-2xl max-w-lg w-full p-6 transition-all duration-200 ${anim.closing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">OCR Result</h2>
          <button onClick={anim.close} aria-label="Close" className="p-2 hover:bg-card-hover rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">Request Info</h3>
            <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3">
              <div>
                <p className="text-xs text-foreground opacity-50">Request ID</p>
                <p className="text-sm font-mono">{billingRequest?.requestId || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-foreground opacity-50">Customer</p>
                <p className="text-sm">{billingRequest?.fullName || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-foreground opacity-50">Amount</p>
                <p className="text-sm">{billingRequest?.billingAmount ? formatCurrency(billingRequest.billingAmount) : 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-foreground opacity-50">Month</p>
                <p className="text-sm">{billingRequest?.billingMonth || 'N/A'}</p>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground mb-2">OCR Result</h3>
            <div className="grid grid-cols-2 gap-3 bg-gray-50 rounded-lg p-3">
              <div>
                <p className="text-xs text-foreground opacity-50">Confidence</p>
                <p className={`text-sm font-medium ${getConfidenceColor(item.confidenceScore)}`}>
                  {Math.round(item.confidenceScore * 100)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-foreground opacity-50">Transaction ID</p>
                <p className="text-sm font-mono">{item.transactionId || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-foreground opacity-50">Amount Paid</p>
                <p className="text-sm">{item.amountPaid ? formatCurrency(item.amountPaid) : 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-foreground opacity-50">Payment Method</p>
                <p className="text-sm">{item.paymentMethod || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-foreground opacity-50">Payment Date</p>
                <p className="text-sm">{item.paymentDate || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-foreground opacity-50">Payment Time</p>
                <p className="text-sm">{item.paymentTime || 'N/A'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-foreground opacity-50">Sender</p>
                <p className="text-sm">{item.senderName || 'N/A'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-foreground opacity-50">Receiver</p>
                <p className="text-sm">{item.receiverName || 'N/A'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-foreground opacity-50">Bank/Wallet</p>
                <p className="text-sm">{item.bankWalletName || 'N/A'}</p>
              </div>
            </div>
          </div>

          {item.rawText && (
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-2">Raw OCR Text</h3>
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
