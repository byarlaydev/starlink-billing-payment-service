'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { useModalAnimation } from '@/hooks/useModalAnimation';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { Search, Plus, Edit, Trash2, Satellite, RefreshCw, Loader2, Download, X } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { exportCsv } from '@/lib/csv-export';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error-utils';
import { Select } from '@/components/ui/select';
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
  customerId: string;
  accountName: string;
  accountNumber: string;
  email: string | null;
  password: string | null;
  regionPlanId: string | null;
  serviceAddress: string | null;
  dueDate: number | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    fullName: string | null;
    facebookName: string | null;
    messengerPsid: string;
  };
  regionPlan: RegionPlan | null;
}

export default function StarlinkAccountsPage() {
  const [accounts, setAccounts] = useState<StarlinkAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<StarlinkAccount | null>(null);
  const modalAnim = useModalAnimation(showModal, () => { setShowModal(false); setEditingAccount(null); });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const fetchAccounts = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await api.get('/starlink-accounts', { params });
      setAccounts(res.data.data.data);
      setTotal(res.data.data.total);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { modalAnim.close(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setEditingAccount(null);
        setShowModal(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleExportCsv = () => {
    exportCsv(
      accounts.map(a => ({
        'Account Name': a.accountName,
        'Account Number': a.accountNumber,
        Email: a.email || '',
        Customer: a.customer.fullName || a.customer.facebookName || '',
        Region: a.regionPlan?.region || '',
        Plan: a.regionPlan?.plan || '',
        Created: formatDate(a.createdAt),
      })),
      `starlink-accounts-${new Date().toISOString().slice(0, 10)}`,
    );
    toast.success('CSV exported');
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/starlink-accounts/${id}`);
      toast.success('Starlink account has been deleted.');
      fetchAccounts();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Starlink Accounts</h1>
          <p className="text-sm text-foreground opacity-50 mt-1">{total} total accounts</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCsv} className="p-2 text-foreground opacity-50 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Export CSV">
            <Download className="w-5 h-5" />
          </button>
          <button onClick={fetchAccounts} className="p-2 text-foreground opacity-50 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Refresh">
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              setEditingAccount(null);
              setShowModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            Add Account
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground opacity-40" />
          <input
            type="text"
            placeholder="Search by email, account number, or customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-card rounded-xl border border-card-border overflow-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-card-border sticky top-0 z-10">
            <tr>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-foreground opacity-50 uppercase">Account</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-foreground opacity-50 uppercase">Customer</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-foreground opacity-50 uppercase">Region & Plan</th>
              <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-foreground opacity-50 uppercase">Created</th>
              <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-foreground opacity-50 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-foreground opacity-50">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                  <span>Loading accounts...</span>
                </td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-foreground opacity-50">
                  <Satellite className="w-8 h-8 mx-auto mb-2 text-foreground opacity-30 animate-float" />
                  <p className="font-medium">No Starlink accounts found</p>
                  <p className="text-xs mt-1">Click "Add Account" to register one</p>
                </td>
              </tr>
            ) : (
              accounts.map((account) => (
                  <tr key={account.id} className="hover:bg-card-hover even:bg-gray-50/40">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Satellite className="w-4 h-4 text-primary-600" />
                        <div>
                          <div className="text-sm font-medium text-foreground">
                            {account.accountName}
                          </div>
                          <div className="text-xs text-foreground opacity-50">#{account.accountNumber}</div>
                          {account.email && (
                            <div className="text-xs text-foreground opacity-50">{account.email}</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-foreground">
                        {account.customer.fullName || account.customer.facebookName || 'N/A'}
                      </div>
                      <div className="text-xs text-foreground opacity-50">{account.customer.messengerPsid}</div>
                    </td>
                    <td className="px-4 py-3">
                      {account.regionPlan ? (
                        <div>
                          <div className="text-sm text-foreground">{account.regionPlan.region}</div>
                          <div className="text-xs text-foreground opacity-50">{account.regionPlan.plan}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-foreground opacity-40">Not set</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground opacity-50">{formatDate(account.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => {
                            setEditingAccount(account);
                            setShowModal(true);
                          }}
                          className="p-1.5 text-foreground opacity-50 hover:text-primary-600 hover:bg-primary-50 rounded"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteConfirm(account.id)}
                          className="p-1.5 text-foreground opacity-50 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={total} limit={20} onPageChange={setPage} />

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Starlink Account"
        message="Are you sure you want to delete this Starlink account? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { handleDelete(deleteConfirm!); setDeleteConfirm(null); }}
        onCancel={() => setDeleteConfirm(null)}
      />

      {modalAnim.visible && (
        <AccountModal
          account={editingAccount}
          onClose={modalAnim.close}
          onRefresh={fetchAccounts}
        />
      )}
    </div>
  );
}

function AccountModal({
  account,
  onClose,
  onRefresh,
}: {
  account: StarlinkAccount | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [formData, setFormData] = useState({
    customerId: account?.customerId || '',
    accountName: account?.accountName || '',
    accountNumber: account?.accountNumber || '',
    email: account?.email || '',
    password: account?.password || '',
    regionPlanId: account?.regionPlanId || '',
    serviceAddress: account?.serviceAddress || '',
    dueDate: account?.dueDate || '',
    notes: account?.notes || '',
  });
  const [customers, setCustomers] = useState<any[]>([]);
  const [regionPlans, setRegionPlans] = useState<RegionPlan[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const anim = useModalAnimation(true, onClose);
  const focusTrapRef = useFocusTrap(anim.visible);
  const { errors, handleBlur, handleChange, validateAll } = useFormValidation({
    accountName: { required: 'Account name is required' },
    accountNumber: { required: 'Account number is required' },
    customerId: { required: 'Customer is required' },
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [customersRes, regionPlansRes] = await Promise.all([
          api.get('/customers', { params: { limit: 100 } }),
          api.get('/region-plan', { params: { isActive: 'true', limit: 100 } }),
        ]);
        setCustomers(customersRes.data.data.data);
        setRegionPlans(regionPlansRes.data.data.data);
      } catch (err) {
        toast.error(getErrorMessage(err));
      }
    };
    fetchData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    if (!validateAll({ accountName: formData.accountName, accountNumber: formData.accountNumber, customerId: formData.customerId })) return;
    try {
      const submitData = {
        ...formData,
        regionPlanId: formData.regionPlanId || undefined,
        dueDate: formData.dueDate ? parseInt(formData.dueDate as string, 10) : undefined,
      };
      if (account) {
        await api.put(`/starlink-accounts/${account.id}`, submitData);
        toast.success('Starlink account has been updated.');
      } else {
        await api.post('/starlink-accounts', submitData);
        toast.success('Starlink account has been created.');
      }
      onRefresh();
      onClose();
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div ref={focusTrapRef} role="dialog" aria-modal="true" className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 transition-opacity duration-200 ${anim.closing ? 'opacity-0' : 'opacity-100'}`} onClick={anim.close}>
      <div className={`bg-card rounded-2xl max-w-md w-full p-6 transition-all duration-200 ${anim.closing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">{account ? 'Edit Account' : 'Add Starlink Account'}</h2>
          <button onClick={anim.close} aria-label="Close" className="p-2 hover:bg-card-hover rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Customer *</label>
            <Select
              value={formData.customerId}
              onChange={(value) => { setFormData({ ...formData, customerId: value }); handleChange('customerId', value); }}
              options={[
                { value: '', label: 'Select a customer' },
                ...customers.map((c) => ({
                  value: c.id,
                  label: c.fullName || c.facebookName || c.messengerPsid,
                })),
              ]}
              placeholder="Select a customer"
              searchable={customers.length > 5}
              disabled={!!account}
              required
            />
            <InputError error={errors.customerId} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Account Name *</label>
              <input
                type="text"
                value={formData.accountName}
                onChange={(e) => { setFormData({ ...formData, accountName: e.target.value }); handleChange('accountName', e.target.value); }}
                onBlur={() => handleBlur('accountName', formData.accountName)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${errors.accountName ? 'border-red-400' : 'border-gray-300'}`}
                required
                placeholder="e.g., Home Internet"
              />
              <InputError error={errors.accountName} />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Account Number *</label>
              <input
                type="text"
                value={formData.accountNumber}
                onChange={(e) => { setFormData({ ...formData, accountNumber: e.target.value }); handleChange('accountNumber', e.target.value); }}
                onBlur={() => handleBlur('accountNumber', formData.accountNumber)}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent ${errors.accountNumber ? 'border-red-400' : 'border-gray-300'}`}
                required
                placeholder="e.g., SL-123456"
              />
              <InputError error={errors.accountNumber} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Account Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="user@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Account Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Enter password"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Region & Plan</label>
            <Select
              value={formData.regionPlanId}
                onChange={(value) => setFormData({ ...formData, regionPlanId: value })}
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
            <label className="block text-sm font-medium text-foreground mb-1">Due Date</label>
            <Select
              value={formData.dueDate?.toString() || ''}
              onChange={(value) => setFormData({ ...formData, dueDate: value })}
              options={[
                { value: '', label: 'No due date' },
                ...Array.from({ length: 28 }, (_, i) => i + 1).map((day) => ({
                  value: day.toString(),
                  label: `Day ${day} of month`,
                })),
              ]}
              placeholder="No due date"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Service Address</label>
            <textarea
              value={formData.serviceAddress}
              onChange={(e) => setFormData({ ...formData, serviceAddress: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Enter service address"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={anim.close}
              className="flex-1 py-2 border border-gray-300 text-foreground rounded-lg hover:bg-card-hover"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {submitting ? 'Saving...' : 'Save Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
