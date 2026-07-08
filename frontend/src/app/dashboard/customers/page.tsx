'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { useModalAnimation } from '@/hooks/useModalAnimation';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { Search, CheckCircle, XCircle, MessageSquare, UserPlus, Satellite, ExternalLink, RefreshCw, Loader2, Download, X } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { exportCsv } from '@/lib/csv-export';
import { toast } from 'sonner';
import { Select } from '@/components/ui/select';
import { getErrorMessage } from '@/lib/error-utils';
import { useAuthStore } from '@/lib/store';
import { useFormValidation, InputError } from '@/hooks/useFormValidation';

interface RegionPlan {
  id: string;
  region: string;
  plan: string;
  description: string | null;
  price: number | null;
  currency: string;
}

interface StarlinkAccount {
  id: string;
  accountName: string;
  accountNumber: string;
  email: string | null;
  password: string | null;
  regionPlanId: string | null;
  serviceAddress: string | null;
  notes: string | null;
  createdAt: string;
  regionPlan: RegionPlan | null;
}

interface Customer {
  id: string;
  messengerPsid: string;
  fullName: string | null;
  facebookName: string | null;
  contactNumber: string | null;
  emailAddress: string | null;
  starlinkEmail: string | null;
  starlinkAccount: string | null;
  dataCollectedBy: string;
  reviewStatus: string;
  isAdminTakeover: boolean;
  createdAt: string;
  _count: { billingRequests: number; conversations: number; starlinkAccounts?: number };
  starlinkAccounts?: StarlinkAccount[];
}

const reviewFilters = ['ALL', 'PENDING_REVIEW', 'APPROVED', 'REJECTED'];

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewFilter, setReviewFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showConversation, setShowConversation] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (reviewFilter !== 'ALL') params.reviewStatus = reviewFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await api.get('/customers', { params });
      setCustomers(res.data.data.data);
      setTotal(res.data.data.total);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [reviewFilter, page, debouncedSearch]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedCustomer(null);
        setShowConversation(false);
        setShowDetailModal(false);
        setShowAddModal(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setShowAddModal(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleExportCsv = () => {
    exportCsv(
      customers.map(c => ({
        Name: c.fullName || '',
        Facebook: c.facebookName || '',
        Contact: c.contactNumber || '',
        Email: c.emailAddress || '',
        'Collected By': c.dataCollectedBy,
        'Review Status': c.reviewStatus,
        Created: formatDate(c.createdAt),
      })),
      `customers-${new Date().toISOString().slice(0, 10)}`,
    );
    toast.success('CSV exported');
  };

  const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await api.put(`/customers/${id}/review`, {
        reviewStatus: status,
        adminId: useAuthStore.getState().user?.id || 'current-admin',
      });
      toast.success(`Customer ${status === 'APPROVED' ? 'approved' : 'rejected'}`);
      fetchCustomers();
    } catch (err) {
      toast.error('Failed to review customer');
    }
  };

  const handleTakeover = async (id: string) => {
    try {
      await api.put(`/customers/${id}/takeover`, { adminId: useAuthStore.getState().user?.id || 'current-admin' });
      toast.success('Conversation taken over');
      fetchCustomers();
    } catch (err) {
      toast.error('Failed to take over conversation');
    }
  };

  const handleRelease = async (id: string) => {
    try {
      await api.put(`/customers/${id}/release`);
      toast.success('Conversation released back to bot');
      fetchCustomers();
    } catch (err) {
      toast.error('Failed to release conversation');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Customers</h1>
          <p className="text-sm text-foreground opacity-50 mt-1">{total} total customers</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCsv} className="p-2 text-foreground opacity-50 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Export CSV">
            <Download className="w-5 h-5" />
          </button>
          <button onClick={fetchCustomers} className="p-2 text-foreground opacity-50 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Refresh">
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <UserPlus className="w-4 h-4" />
            Add Customer
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground opacity-40" />
          <input
            type="text"
            placeholder="Search by name, email, PSID, Starlink account..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {reviewFilters.map((f) => (
          <button
            key={f}
            onClick={() => { setReviewFilter(f); setPage(1); }}
            className={cn(
              'px-3 py-1.5 rounded-full text-xs font-medium transition-colors',
              reviewFilter === f ? 'bg-primary-600 text-white' : 'bg-gray-100 text-foreground opacity-60 hover:bg-card-hover',
            )}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="bg-card rounded-xl border border-card-border overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-card-border sticky top-0 z-10">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-foreground opacity-50 uppercase">Name</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-foreground opacity-50 uppercase">Contact</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-foreground opacity-50 uppercase">Starlink Accounts</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-foreground opacity-50 uppercase">Collected By</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-foreground opacity-50 uppercase">Review</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-foreground opacity-50 uppercase">Status</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-foreground opacity-50 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-foreground opacity-50">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <span>Loading customers...</span>
                </td>
              </tr>
            ) : customers.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-foreground opacity-50">
                  <p className="font-medium">No customers found</p>
                  <p className="text-xs mt-1">Try adjusting your search or filters</p>
                </td>
              </tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-card-hover even:bg-gray-50/40">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-foreground">{customer.fullName || 'N/A'}</div>
                    <div className="text-xs text-foreground opacity-50">{customer.facebookName || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-foreground opacity-60">{customer.contactNumber || 'N/A'}</div>
                    <div className="text-xs text-foreground opacity-50">{customer.emailAddress || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={async () => {
                        try {
                          const res = await api.get(`/customers/${customer.id}`);
                          setSelectedCustomer(res.data.data);
                          setShowDetailModal(true);
                        } catch {
                          toast.error('Failed to load customer details');
                        }
                      }}
                      className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-800 hover:underline"
                    >
                      <Satellite className="w-3.5 h-3.5" />
                      {customer._count?.starlinkAccounts ?? 0} account{(customer._count?.starlinkAccounts ?? 0) !== 1 ? 's' : ''}
                      {customer.starlinkEmail && (
                        <span className="text-xs text-foreground opacity-40 ml-1">({customer.starlinkEmail})</span>
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      customer.dataCollectedBy === 'bot' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                    )}>
                      {customer.dataCollectedBy}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn(
                      'px-2 py-1 rounded-full text-xs font-medium',
                      customer.reviewStatus === 'APPROVED' ? 'bg-green-100 text-green-800' :
                      customer.reviewStatus === 'REJECTED' ? 'bg-red-100 text-red-800' :
                      'bg-yellow-100 text-yellow-800'
                    )}>
                      {customer.reviewStatus.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {customer.isAdminTakeover ? (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                        Admin Active
                      </span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                        Bot Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setSelectedCustomer(customer); setShowConversation(true); }}
                        className="p-1.5 text-foreground opacity-50 hover:text-primary-600 hover:bg-primary-50 rounded"
                        title="View Conversation"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      {customer.reviewStatus === 'PENDING_REVIEW' && customer.dataCollectedBy === 'bot' && (
                        <>
                          <button
                            onClick={() => handleReview(customer.id, 'APPROVED')}
                            className="p-1.5 text-foreground opacity-50 hover:text-green-600 hover:bg-green-50 rounded"
                            title="Approve"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReview(customer.id, 'REJECTED')}
                            className="p-1.5 text-foreground opacity-50 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {customer.isAdminTakeover ? (
                        <button
                          onClick={() => handleRelease(customer.id)}
                          className="px-2 py-1 text-xs bg-gray-100 text-foreground rounded hover:bg-card-hover"
                        >
                          Release
                        </button>
                      ) : (
                        <button
                          onClick={() => handleTakeover(customer.id)}
                          className="px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded hover:bg-purple-200"
                        >
                          Take Over
                        </button>
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

      {selectedCustomer && (
        <ConversationModal
          open={showConversation}
          customer={selectedCustomer}
          onClose={() => { setShowConversation(false); setSelectedCustomer(null); }}
          onRefresh={fetchCustomers}
        />
      )}

      {selectedCustomer && (
        <CustomerDetailModal
          open={showDetailModal}
          customer={selectedCustomer}
          onClose={() => { setShowDetailModal(false); setSelectedCustomer(null); }}
          onRefresh={fetchCustomers}
        />
      )}

      <AddCustomerModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onRefresh={fetchCustomers}
      />
    </div>
  );
}

function CustomerDetailModal({ open, customer, onClose, onRefresh }: { open: boolean; customer: Customer; onClose: () => void; onRefresh: () => void }) {
  const [accounts, setAccounts] = useState<StarlinkAccount[]>(customer.starlinkAccounts || []);
  const [loadingAccounts, setLoadingAccounts] = useState(!customer.starlinkAccounts);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({ accountName: '', accountNumber: '', email: '', password: '', regionPlanId: '', serviceAddress: '', notes: '' });
  const [regionPlans, setRegionPlans] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const { errors: acctErrors, handleBlur: acctBlur, handleChange: acctChange, validateAll: validateAcct } = useFormValidation({
    accountName: { required: 'Account name is required' },
    accountNumber: { required: 'Account number is required' },
  });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const anim = useModalAnimation(open, onClose);
  const focusTrapRef = useFocusTrap(anim.visible);

  if (!anim.visible) return null;

  useEffect(() => {
    if (!customer.starlinkAccounts) {
      const fetchAccounts = async () => {
        try {
          const res = await api.get(`/starlink-accounts/customer/${customer.id}`);
          setAccounts(res.data.data);
        } catch (err) {
          toast.error(getErrorMessage(err));
        } finally {
          setLoadingAccounts(false);
        }
      };
      fetchAccounts();
    }
    const fetchRegionPlans = async () => {
      try {
        const res = await api.get('/region-plan', { params: { isActive: 'true', limit: 100 } });
        setRegionPlans(res.data.data.data);
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    };
    fetchRegionPlans();
  }, [customer.id, customer.starlinkAccounts]);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAcct({ accountName: newAccount.accountName, accountNumber: newAccount.accountNumber })) return;
    setSubmitting(true);
    try {
      await api.post('/starlink-accounts', {
        customerId: customer.id,
        accountName: newAccount.accountName,
        accountNumber: newAccount.accountNumber,
        email: newAccount.email || undefined,
        password: newAccount.password || undefined,
        regionPlanId: newAccount.regionPlanId || undefined,
        serviceAddress: newAccount.serviceAddress || undefined,
        notes: newAccount.notes || undefined,
      });
      toast.success('Starlink account added');
      setNewAccount({ accountName: '', accountNumber: '', email: '', password: '', regionPlanId: '', serviceAddress: '', notes: '' });
      setShowAddAccount(false);
      const res = await api.get(`/starlink-accounts/customer/${customer.id}`);
      setAccounts(res.data.data);
      onRefresh();
    } catch (err) {
      toast.error('Failed to add account');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    try {
      await api.delete(`/starlink-accounts/${accountId}`);
      toast.success('Account deleted');
      const res = await api.get(`/starlink-accounts/customer/${customer.id}`);
      setAccounts(res.data.data);
      onRefresh();
    } catch (err) {
      toast.error('Failed to delete account');
    }
  };

  return (
    <div ref={focusTrapRef} role="dialog" aria-modal="true" className={cn("fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 transition-opacity duration-200", anim.closing ? "opacity-0" : "opacity-100")}>
      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Starlink Account"
        message="Are you sure you want to delete this Starlink account? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { if (deleteConfirm) handleDeleteAccount(deleteConfirm); setDeleteConfirm(null); }}
        onCancel={() => setDeleteConfirm(null)}
      />
      <div className={cn("bg-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto transition-all duration-200", anim.closing ? "scale-95 opacity-0" : "scale-100 opacity-100")}>
          <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-card z-10">
            <div>
              <h2 className="text-xl font-bold">{customer.fullName || customer.facebookName || 'Customer'}</h2>
              <p className="text-sm text-foreground opacity-50">PSID: {customer.messengerPsid}</p>
            </div>
            <button onClick={anim.close} aria-label="Close" className="p-2 hover:bg-card-hover rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-foreground opacity-50">Full Name</p>
              <p className="font-medium">{customer.fullName || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-foreground opacity-50">Facebook Name</p>
              <p className="font-medium">{customer.facebookName || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-foreground opacity-50">Contact Number</p>
              <p className="font-medium">{customer.contactNumber || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-foreground opacity-50">Email Address</p>
              <p className="font-medium">{customer.emailAddress || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-foreground opacity-50">Data Collected By</p>
              <span className={cn(
                'px-2 py-1 rounded-full text-xs font-medium',
                customer.dataCollectedBy === 'bot' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
              )}>
                {customer.dataCollectedBy}
              </span>
            </div>
            <div>
              <p className="text-xs text-foreground opacity-50">Review Status</p>
              <span className={cn(
                'px-2 py-1 rounded-full text-xs font-medium',
                customer.reviewStatus === 'APPROVED' ? 'bg-green-100 text-green-800' :
                customer.reviewStatus === 'REJECTED' ? 'bg-red-100 text-red-800' :
                'bg-yellow-100 text-yellow-800'
              )}>
                {customer.reviewStatus.replace('_', ' ')}
              </span>
            </div>
            <div>
              <p className="text-xs text-foreground opacity-50">Billing Requests</p>
              <p className="font-medium">{customer._count?.billingRequests ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-foreground opacity-50">Conversations</p>
              <p className="font-medium">{customer._count?.conversations ?? 0}</p>
            </div>
          </div>

          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Satellite className="w-5 h-5 text-primary-600" />
                Starlink Accounts ({accounts.length})
              </h3>
              <button
                onClick={() => setShowAddAccount(!showAddAccount)}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Add Account
              </button>
            </div>

            {showAddAccount && (
              <form onSubmit={handleAddAccount} className="mb-4 p-4 bg-gray-50 rounded-lg space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Account Name *</label>
                    <input
                      type="text"
                      value={newAccount.accountName}
                      onChange={(e) => { setNewAccount({ ...newAccount, accountName: e.target.value }); acctChange('accountName', e.target.value); }}
                      onBlur={() => acctBlur('accountName', newAccount.accountName)}
                      className={cn('w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent', acctErrors.accountName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600')}
                      required
                      placeholder="e.g., Home Internet"
                    />
                    <InputError error={acctErrors.accountName} />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Account Number *</label>
                    <input
                      type="text"
                      value={newAccount.accountNumber}
                      onChange={(e) => { setNewAccount({ ...newAccount, accountNumber: e.target.value }); acctChange('accountNumber', e.target.value); }}
                      onBlur={() => acctBlur('accountNumber', newAccount.accountNumber)}
                      className={cn('w-full px-3 py-1.5 text-sm border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent', acctErrors.accountNumber ? 'border-red-500' : 'border-gray-300 dark:border-gray-600')}
                      required
                      placeholder="e.g., SL-123456"
                    />
                    <InputError error={acctErrors.accountNumber} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Account Email</label>
                    <input
                      type="email"
                      value={newAccount.email}
                      onChange={(e) => { setNewAccount({ ...newAccount, email: e.target.value }); acctChange('email', e.target.value); }}
                      onBlur={() => acctBlur('email', newAccount.email)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="user@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1">Account Password</label>
                    <input
                      type="text"
                      value={newAccount.password}
                      onChange={(e) => { setNewAccount({ ...newAccount, password: e.target.value }); acctChange('password', e.target.value); }}
                      onBlur={() => acctBlur('password', newAccount.password)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Enter password"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Region & Plan</label>
                <Select
                  value={newAccount.regionPlanId}
                  onChange={(value) => setNewAccount({ ...newAccount, regionPlanId: value })}
                  options={[
                    { value: '', label: 'Select region and plan' },
                    ...regionPlans.map((rp) => ({
                      value: rp.id,
                      label: `${rp.region} - ${rp.plan}${rp.price ? ` ($${rp.price})` : ''}`,
                    })),
                  ]}
                  placeholder="Select region and plan"
                  searchable={regionPlans.length > 5}
                />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Service Address</label>
                    <input
                      type="text"
                      value={newAccount.serviceAddress}
                      onChange={(e) => { setNewAccount({ ...newAccount, serviceAddress: e.target.value }); acctChange('serviceAddress', e.target.value); }}
                      onBlur={() => acctBlur('serviceAddress', newAccount.serviceAddress)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Enter service address"
                    />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">Notes</label>
                    <input
                      type="text"
                      value={newAccount.notes}
                      onChange={(e) => { setNewAccount({ ...newAccount, notes: e.target.value }); acctChange('notes', e.target.value); }}
                      onBlur={() => acctBlur('notes', newAccount.notes)}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Additional notes"
                    />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddAccount(false)}
                    className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-card-hover"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {submitting ? 'Adding...' : 'Add Account'}
                  </button>
                </div>
              </form>
            )}

            {loadingAccounts ? (
              <div className="text-center py-4 text-foreground opacity-50">Loading accounts...</div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-6 text-foreground opacity-50 bg-gray-50 rounded-lg">
                <Satellite className="w-8 h-8 mx-auto mb-2 text-foreground opacity-30 animate-float" />
                <p>No Starlink accounts registered</p>
                <p className="text-xs mt-1">Click "Add Account" to register one</p>
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-card-border bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <Satellite className="w-4 h-4 text-foreground opacity-40" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{account.accountName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-foreground opacity-50">
                          <span>#{account.accountNumber}</span>
                          {account.email && <span>{account.email}</span>}
                          {account.regionPlan && (
                            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
                              {account.regionPlan.region} - {account.regionPlan.plan}
                            </span>
                          )}
                          <span>Created {formatDate(account.createdAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => setDeleteConfirm(account.id)}
                        className="p-1.5 text-foreground opacity-40 hover:text-red-600 hover:bg-red-50 rounded"
                        title="Delete account"
                      >
                        <XCircle className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-3">
              <a
                href={`/dashboard/starlink-accounts?customerId=${customer.id}`}
                className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-800"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                View all accounts in Starlink Accounts page
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConversationModal({ open, customer, onClose, onRefresh }: { open: boolean; customer: Customer; onClose: () => void; onRefresh: () => void }) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const anim = useModalAnimation(open, onClose);
  const focusTrapRef = useFocusTrap(anim.visible);

  if (!anim.visible) return null;

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await api.get(`/customers/${customer.id}/conversations`);
        setConversations(res.data.data.reverse());
      } catch (err) {
        toast.error(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    };
    fetchConversations();
  }, [customer.id]);

  const sendMessage = async () => {
    if (!message.trim()) return;
    setSending(true);
    try {
      await api.post(`/customers/${customer.id}/message`, {
        content: message,
        adminId: useAuthStore.getState().user?.id || 'current-admin',
      });
      setMessage('');
      const res = await api.get(`/customers/${customer.id}/conversations`);
      setConversations(res.data.data.reverse());
      toast.success('Message sent');
    } catch (err) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  return (
    <div ref={focusTrapRef} role="dialog" aria-modal="true" className={cn("fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 transition-opacity duration-200", anim.closing ? "opacity-0" : "opacity-100")}>
      <div className={cn("bg-card rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col transition-all duration-200", anim.closing ? "scale-95 opacity-0" : "scale-100 opacity-100")}>
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold">Conversation with {customer.fullName || customer.facebookName}</h2>
            <p className="text-sm text-foreground opacity-50">PSID: {customer.messengerPsid}</p>
          </div>
          <button onClick={anim.close} aria-label="Close" className="p-2 hover:bg-card-hover rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <div className="text-center text-foreground opacity-50">Loading conversations...</div>
          ) : conversations.length === 0 ? (
            <div className="text-center text-foreground opacity-50">No conversations yet</div>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                className={cn(
                  'flex',
                  conv.direction === 'inbound' ? 'justify-start' : 'justify-end'
                )}
              >
                <div className={cn(
                  'max-w-[70%] rounded-lg px-4 py-2',
                  conv.direction === 'inbound'
                    ? 'bg-gray-100 text-foreground'
                    : conv.isAdminTakeover
                      ? 'bg-purple-100 text-purple-900'
                      : 'bg-primary-100 text-primary-900'
                )}>
                  <div className="text-sm">{conv.content}</div>
                  <div className="text-xs text-foreground opacity-50 mt-1">
                    {formatDate(conv.createdAt)}
                    {conv.isAdminTakeover && ' (Admin)'}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {customer.isAdminTakeover && (
          <div className="p-4 border-t">
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
                placeholder="Type a message..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                onClick={sendMessage}
                disabled={sending || !message.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center gap-2"
              >
                {sending && <Loader2 className="w-4 h-4 animate-spin" />}
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddCustomerModal({ open, onClose, onRefresh }: { open: boolean; onClose: () => void; onRefresh: () => void }) {
  const [formData, setFormData] = useState({
    fullName: '',
    facebookName: '',
    contactNumber: '',
    emailAddress: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const { errors, handleBlur, handleChange, validateAll } = useFormValidation({
    fullName: { required: 'Full name is required' },
  });
  const anim = useModalAnimation(open, onClose);
  const focusTrapRef = useFocusTrap(anim.visible);

  if (!anim.visible) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll({ fullName: formData.fullName })) return;
    setSubmitting(true);
    try {
      await api.post('/customers', { ...formData, adminId: useAuthStore.getState().user?.id || 'current-admin' });
      toast.success('Customer created');
      onRefresh();
      anim.close();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div ref={focusTrapRef} role="dialog" aria-modal="true" className={cn("fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 transition-opacity duration-200", anim.closing ? "opacity-0" : "opacity-100")}>
      <div className={cn("bg-card rounded-2xl max-w-md w-full p-6 transition-all duration-200", anim.closing ? "scale-95 opacity-0" : "scale-100 opacity-100")}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Add Customer</h2>
          <button onClick={anim.close} aria-label="Close" className="p-2 hover:bg-card-hover rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Full Name *</label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => { setFormData({ ...formData, fullName: e.target.value }); handleChange('fullName', e.target.value); }}
              onBlur={() => handleBlur('fullName', formData.fullName)}
              className={cn('w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent', errors.fullName ? 'border-red-500' : 'border-gray-300 dark:border-gray-600')}
              required
            />
            <InputError error={errors.fullName} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Facebook Name</label>
            <input
              type="text"
              value={formData.facebookName}
              onChange={(e) => { setFormData({ ...formData, facebookName: e.target.value }); handleChange('facebookName', e.target.value); }}
              onBlur={() => handleBlur('facebookName', formData.facebookName)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Contact Number</label>
            <input
              type="text"
              value={formData.contactNumber}
              onChange={(e) => { setFormData({ ...formData, contactNumber: e.target.value }); handleChange('contactNumber', e.target.value); }}
              onBlur={() => handleBlur('contactNumber', formData.contactNumber)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Email Address</label>
            <input
              type="email"
              value={formData.emailAddress}
              onChange={(e) => { setFormData({ ...formData, emailAddress: e.target.value }); handleChange('emailAddress', e.target.value); }}
              onBlur={() => handleBlur('emailAddress', formData.emailAddress)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={anim.close}
              className="flex-1 py-2 border border-gray-300 dark:border-gray-600 text-foreground rounded-lg hover:bg-card-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Creating...' : 'Create Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
