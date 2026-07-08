'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { formatCurrency, formatDate, getStatusColor, getConfidenceColor, cn } from '@/lib/utils';
import { Search, Filter, Eye, CheckCircle, XCircle, Clock } from 'lucide-react';

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
  paymentProofs: any[];
  _count: { paymentProofs: number; activityLogs: number };
}

const statusFilters = ['ALL', 'PENDING', 'PROCESSING', 'APPROVED', 'COMPLETED', 'REJECTED', 'MANUAL_REVIEW'];

export default function RequestsPage() {
  const [requests, setRequests] = useState<BillingRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedRequest, setSelectedRequest] = useState<BillingRequest | null>(null);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (search) params.search = search;
      const res = await api.get('/billing', { params });
      setRequests(res.data.data.data);
      setTotal(res.data.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchRequests(); }, [statusFilter, page, search]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await api.put(`/billing/${id}/status`, { status });
      fetchRequests();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Billing Requests</h1>
        <span className="text-sm text-gray-500">{total} total requests</span>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
              statusFilter === s ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {s}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Request ID</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Month</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : requests.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No requests found</td></tr>
            ) : (
              requests.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-mono text-primary-600">{req.requestId}</td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{req.fullName}</div>
                    <div className="text-xs text-gray-500">{req.contactNumber || req.emailAddress}</div>
                  </td>
                  <td className="px-4 py-3 text-sm font-medium">{formatCurrency(req.billingAmount)}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{req.billingMonth}</td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2 py-1 rounded-full text-xs font-medium', getStatusColor(req.status))}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(req.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setSelectedRequest(req)} className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded">
                        <Eye className="w-4 h-4" />
                      </button>
                      {req.status === 'PENDING' && (
                        <>
                          <button onClick={() => updateStatus(req.id, 'APPROVED')} className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button onClick={() => updateStatus(req.id, 'REJECTED')} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded">
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

      {total > 20 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 20)}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / 20)}
            className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {selectedRequest && (
        <RequestDetailModal request={selectedRequest} onClose={() => setSelectedRequest(null)} onUpdate={fetchRequests} />
      )}
    </div>
  );
}

function RequestDetailModal({ request, onClose, onUpdate }: { request: BillingRequest; onClose: () => void; onUpdate: () => void }) {
  const updateStatus = async (status: string) => {
    try {
      await api.put(`/billing/${request.id}/status`, { status });
      onUpdate();
      onClose();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Request {request.requestId}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">X</button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <div>
            <p className="text-xs text-gray-500">Full Name</p>
            <p className="font-medium">{request.fullName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Facebook Name</p>
            <p className="font-medium">{request.facebookName || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Contact</p>
            <p className="font-medium">{request.contactNumber || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Email</p>
            <p className="font-medium">{request.emailAddress || 'N/A'}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Billing Amount</p>
            <p className="font-medium">{formatCurrency(request.billingAmount)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Billing Month</p>
            <p className="font-medium">{request.billingMonth}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Status</p>
            <span className={cn('px-2 py-1 rounded-full text-xs font-medium', getStatusColor(request.status))}>
              {request.status}
            </span>
          </div>
          <div>
            <p className="text-xs text-gray-500">Payment Proofs</p>
            <p className="font-medium">{request._count?.paymentProofs || 0} files</p>
          </div>
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
