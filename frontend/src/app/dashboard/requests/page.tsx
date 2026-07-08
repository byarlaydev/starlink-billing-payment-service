'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, getStatusColor, cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { Pagination } from '@/components/ui/pagination';
import { exportCsv } from '@/lib/csv-export';
import { useModalAnimation } from '@/hooks/useModalAnimation';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { Search, Eye, CheckCircle, XCircle, Loader2, RefreshCw, Download, History, X } from 'lucide-react';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error-utils';

interface BillingRequest {
  id: string;
  requestId: string;
  fullName: string;
  facebookName: string | null;
  contactNumber: string | null;
  emailAddress: string | null;
  billingAmount: number;
  billingMonth: string;
  status: string;
  createdAt: string;
  customer: { facebookName: string };
  _count: { paymentProofs: number; activityLogs: number };
}

const statusFilters = ['ALL', 'PENDING', 'PROCESSING', 'APPROVED', 'COMPLETED', 'REJECTED', 'MANUAL_REVIEW'];

export default function RequestsPage() {
  const [requests, setRequests] = useState<BillingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedRequest, setSelectedRequest] = useState<BillingRequest | null>(null);
  const modalAnim = useModalAnimation(!!selectedRequest, () => setSelectedRequest(null));

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await api.get('/billing', { params });
      setRequests(res.data.data.data);
      setTotal(res.data.data.total);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, page, debouncedSearch]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') modalAnim.close();
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setSelectedRequest(null);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.put(`/billing/${id}/status`, { status });
      toast.success(`Request ${status.toLowerCase()}`);
      fetchRequests();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleExportCsv = () => {
    exportCsv(
      requests.map(r => ({
        'Request ID': r.requestId,
        'Customer Name': r.fullName,
        Contact: r.contactNumber || r.emailAddress || '',
        Amount: r.billingAmount,
        Month: r.billingMonth,
        Status: r.status,
        Created: formatDate(r.createdAt),
      })),
      `billing-requests-${new Date().toISOString().slice(0, 10)}`,
    );
    toast.success('CSV exported');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Billing Requests</h1>
          <p className="text-sm text-foreground opacity-50 mt-1">{total} total requests</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCsv} className="p-2 text-foreground opacity-50 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Export CSV">
            <Download className="w-5 h-5" />
          </button>
          <button onClick={fetchRequests} className="p-2 text-foreground opacity-50 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Refresh">
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground opacity-40" />
          <input
            type="text"
            placeholder="Search by name, ID, email, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {statusFilters.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              statusFilter === s ? 'bg-primary-600 text-white' : 'bg-gray-100 text-foreground opacity-60 hover:bg-card-hover',
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-card-border overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-card-border sticky top-0 z-10">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-foreground opacity-50 uppercase">Request ID</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-foreground opacity-50 uppercase">Customer</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-foreground opacity-50 uppercase">Amount</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-foreground opacity-50 uppercase">Month</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-foreground opacity-50 uppercase">Status</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-foreground opacity-50 uppercase">Date</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-foreground opacity-50 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-foreground opacity-50">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <span>Loading requests...</span>
                </td>
              </tr>
            ) : requests.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-foreground opacity-50">
                  <p className="font-medium">No requests found</p>
                  <p className="text-xs mt-1">Try adjusting your filters</p>
                </td>
              </tr>
            ) : (
              requests.map((req) => (
                <tr key={req.id} className="hover:bg-card-hover even:bg-gray-50/40">
                  <td className="px-4 py-3 text-sm font-mono text-primary-600">{req.requestId}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-foreground">{req.fullName}</div>
                    <div className="text-xs text-foreground opacity-50">{req.contactNumber || req.emailAddress}</div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{formatCurrency(req.billingAmount)}</td>
                  <td className="px-4 py-3 text-sm text-foreground opacity-60">{req.billingMonth}</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-1 rounded-full text-xs font-medium', getStatusColor(req.status))}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground opacity-50">{formatDate(req.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setSelectedRequest(req)} className="p-1.5 text-foreground opacity-50 hover:text-primary-600 hover:bg-primary-50 rounded">
                        <Eye className="w-4 h-4" />
                      </button>
                      {req.status === 'PENDING' && (
                        <>
                          <button onClick={() => updateStatus(req.id, 'APPROVED')} className="p-1.5 text-foreground opacity-50 hover:text-green-600 hover:bg-green-50 rounded">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button onClick={() => updateStatus(req.id, 'REJECTED')} className="p-1.5 text-foreground opacity-50 hover:text-red-600 hover:bg-red-50 rounded">
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={total} limit={20} onPageChange={setPage} />

      {modalAnim.visible && (
        <RequestDetailModal request={selectedRequest!} onClose={modalAnim.close} onUpdate={fetchRequests} />
      )}
    </div>
  );
}

function RequestDetailModal({ request, onClose, onUpdate }: { request: BillingRequest; onClose: () => void; onUpdate: () => void }) {
  const [proofs, setProofs] = useState<any[]>([]);
  const [loadingProofs, setLoadingProofs] = useState(false);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [activityLogs, setActivityLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const anim = useModalAnimation(true, onClose);
  const focusTrapRef = useFocusTrap(anim.visible);

  useEffect(() => {
    const fetchProofs = async () => {
      setLoadingProofs(true);
      try {
        const res = await api.get(`/payment-proofs/request/${request.id}`);
        setProofs(res.data.data);
      } catch { /* silent */ } finally {
        setLoadingProofs(false);
      }
    };
    fetchProofs();
  }, [request.id]);

  useEffect(() => {
    const fetchLogs = async () => {
      setLoadingLogs(true);
      try {
        const res = await api.get(`/billing/${request.id}`);
        setActivityLogs(res.data.data.activityLogs || []);
      } catch { /* silent */ } finally {
        setLoadingLogs(false);
      }
    };
    fetchLogs();
  }, [request.id]);

  useEffect(() => {
    const loadImages = async () => {
      const urls: Record<string, string> = {};
      for (const p of proofs) {
        try {
          const res = await api.get(`/payment-proofs/${p.id}/file`, { responseType: 'blob' });
          urls[p.id] = URL.createObjectURL(res.data);
        } catch { /* silent */ }
      }
      setImageUrls(urls);
      return () => { Object.values(urls).forEach(u => URL.revokeObjectURL(u)); };
    };
    if (proofs.length > 0) loadImages();
  }, [proofs]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') anim.close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [anim.close]);

  const updateStatus = async (status: string) => {
    try {
      await api.put(`/billing/${request.id}/status`, { status });
      onUpdate();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div ref={focusTrapRef} role="dialog" aria-modal="true" className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 transition-opacity duration-200 ${anim.closing ? 'opacity-0' : 'opacity-100'}`} onClick={anim.close}>
      <div className={`bg-card rounded-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 transition-all duration-200 ${anim.closing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Request {request.requestId}</h2>
          <button onClick={anim.close} aria-label="Close" className="p-2 hover:bg-card-hover rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-xs text-foreground opacity-50">Full Name</p>
            <p className="font-medium">{request.fullName}</p>
          </div>
          <div>
            <p className="text-xs text-foreground opacity-50">Facebook Name</p>
            <p className="font-medium">{request.facebookName || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-foreground opacity-50">Contact</p>
            <p className="font-medium">{request.contactNumber || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-foreground opacity-50">Email</p>
            <p className="font-medium">{request.emailAddress || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-foreground opacity-50">Billing Amount</p>
            <p className="font-medium">{formatCurrency(request.billingAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-foreground opacity-50">Billing Month</p>
            <p className="font-medium">{request.billingMonth}</p>
          </div>
          <div>
            <p className="text-xs text-foreground opacity-50">Status</p>
            <span className={cn('px-2 py-1 rounded-full text-xs font-medium', getStatusColor(request.status))}>
              {request.status}
            </span>
          </div>
          <div>
            <p className="text-xs text-foreground opacity-50">Payment Proofs</p>
            <p className="font-medium">{proofs.length} files</p>
          </div>
        </div>

        {/* Payment Proofs */}
        {loadingProofs ? (
          <div className="flex items-center justify-center py-4 text-sm text-foreground opacity-50">
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Loading proofs...
          </div>
        ) : proofs.length > 0 ? (
          <div className="mb-6 space-y-4">
            <h3 className="text-sm font-semibold text-foreground">Payment Proofs</h3>
            <div className="grid grid-cols-2 gap-4">
              {proofs.map((proof) => (
                <div key={proof.id} className="border border-card-border rounded-lg overflow-hidden">
                  {imageUrls[proof.id] ? (
                    <img src={imageUrls[proof.id]} alt={proof.originalFilename} className="w-full h-48 object-contain bg-gray-50" />
                  ) : (
                    <div className="w-full h-48 flex items-center justify-center bg-gray-50 text-foreground opacity-40 text-sm">
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading image...
                    </div>
                  )}
                  <div className="p-2 bg-gray-50 border-t border-card-border">
                    <p className="text-xs font-medium text-foreground truncate">{proof.originalFilename}</p>
                    <div className="flex items-center gap-2 text-[10px] text-foreground opacity-50 mt-0.5">
                      <span>{(proof.fileSize / 1024).toFixed(0)} KB</span>
                      {proof.ocrResults?.length > 0 && (
                        <>
                          <span>·</span>
                          <span className={cn(
                            'font-medium',
                            parseFloat(proof.ocrResults[0].confidenceScore) >= 0.8 ? 'text-green-600' :
                            parseFloat(proof.ocrResults[0].confidenceScore) >= 0.5 ? 'text-yellow-600' : 'text-red-600'
                          )}>
                            {Math.round(parseFloat(proof.ocrResults[0].confidenceScore) * 100)}% confidence
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {proof.ocrResults?.length > 0 && (
                    <div className="p-2 space-y-1 bg-gray-50 border-t border-gray-100">
                      {proof.ocrResults.map((ocr: any) => (
                        <div key={ocr.id} className="text-[10px] text-foreground opacity-60">
                          {ocr.transactionId && <p>Tx: <span className="font-mono">{ocr.transactionId}</span></p>}
                          {ocr.amountPaid && <p>Amount: {formatCurrency(ocr.amountPaid)}</p>}
                          {ocr.paymentMethod && <p>Method: {ocr.paymentMethod}</p>}
                          {ocr.paymentDate && <p>Date: {ocr.paymentDate}</p>}
                          {ocr.senderName && <p>From: {ocr.senderName}</p>}
                          {ocr.bankWalletName && <p>Bank: {ocr.bankWalletName}</p>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* Activity Logs */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <History className="w-4 h-4 text-foreground opacity-50" />
            <h3 className="text-sm font-semibold text-foreground">Activity Log</h3>
          </div>
          {loadingLogs ? (
            <div className="flex items-center justify-center py-3 text-sm text-foreground opacity-50">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Loading logs...
            </div>
          ) : activityLogs.length === 0 ? (
            <p className="text-sm text-foreground opacity-40 py-3">No activity recorded</p>
          ) : (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {activityLogs.map((log: any) => (
                <div key={log.id} className="flex items-start gap-3 py-2 border-b border-gray-100 last:border-0">
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold uppercase',
                    log.actorType === 'admin' ? 'bg-purple-100 text-purple-700' :
                    log.actorType === 'system' ? 'bg-blue-100 text-blue-700' :
                    log.actorType === 'ai' ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-foreground'
                  )}>
                    {log.actorType?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground">{log.description}</p>
                    <p className="text-[10px] text-foreground opacity-40 mt-0.5">{formatDate(log.createdAt)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t pt-4">
          {request.status === 'PENDING' && (
            <>
              <button onClick={() => updateStatus('APPROVED')} className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
                Approve
              </button>
              <button onClick={() => updateStatus('PROCESSING')} className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700">
                Process
              </button>
              <button onClick={() => updateStatus('REJECTED')} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700">
                Reject
              </button>
            </>
          )}
          {request.status === 'MANUAL_REVIEW' && (
            <>
              <button onClick={() => updateStatus('APPROVED')} className="flex-1 py-2 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
                Approve
              </button>
              <button onClick={() => updateStatus('REJECTED')} className="flex-1 py-2 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700">
                Reject
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
