'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { Search, Plus, Edit, Trash2, Star, Satellite } from 'lucide-react';
import { toast } from 'sonner';

interface StarlinkAccount {
  id: string;
  customerId: string;
  email: string;
  accountNumber: string | null;
  nickname: string | null;
  isPrimary: boolean;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  customer: {
    id: string;
    fullName: string | null;
    facebookName: string | null;
    messengerPsid: string;
  };
}

export default function StarlinkAccountsPage() {
  const [accounts, setAccounts] = useState<StarlinkAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<StarlinkAccount | null>(null);

  const fetchAccounts = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (search) params.search = search;
      const res = await api.get('/starlink-accounts', { params });
      setAccounts(res.data.data.data);
      setTotal(res.data.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccounts();
  }, [page, search]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this Starlink account?')) return;
    try {
      await api.delete(`/starlink-accounts/${id}`);
      toast.success('Account deleted');
      fetchAccounts();
    } catch (err) {
      toast.error('Failed to delete account');
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      await api.put(`/starlink-accounts/${id}/set-primary`);
      toast.success('Account set as primary');
      fetchAccounts();
    } catch (err) {
      toast.error('Failed to set primary account');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Starlink Accounts</h1>
          <p className="text-sm text-gray-500 mt-1">Manage customer Starlink accounts</p>
        </div>
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

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by email, account number, or customer name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Account</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Loading...
                </td>
              </tr>
            ) : accounts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  No Starlink accounts found
                </td>
              </tr>
            ) : (
              accounts.map((account) => (
                <tr key={account.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Satellite className="w-4 h-4 text-primary-600" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {account.email}
                          {account.isPrimary && (
                            <Star className="inline w-3 h-3 ml-1 text-yellow-500 fill-yellow-500" />
                          )}
                        </div>
                        {account.accountNumber && (
                          <div className="text-xs text-gray-500">#{account.accountNumber}</div>
                        )}
                        {account.nickname && (
                          <div className="text-xs text-gray-500">{account.nickname}</div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">
                      {account.customer.fullName || account.customer.facebookName || 'N/A'}
                    </div>
                    <div className="text-xs text-gray-500">{account.customer.messengerPsid}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'px-2 py-1 rounded-full text-xs font-medium',
                        account.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                      )}
                    >
                      {account.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(account.createdAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {!account.isPrimary && (
                        <button
                          onClick={() => handleSetPrimary(account.id)}
                          className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded"
                          title="Set as primary"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => {
                          setEditingAccount(account);
                          setShowModal(true);
                        }}
                        className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded"
                        title="Edit"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(account.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
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

      {total > 20 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {Math.ceil(total / 20)}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={page >= Math.ceil(total / 20)}
            className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {showModal && (
        <AccountModal
          account={editingAccount}
          onClose={() => {
            setShowModal(false);
            setEditingAccount(null);
          }}
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
    email: account?.email || '',
    accountNumber: account?.accountNumber || '',
    nickname: account?.nickname || '',
    isPrimary: account?.isPrimary || false,
    isActive: account?.isActive ?? true,
    notes: account?.notes || '',
  });
  const [customers, setCustomers] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const res = await api.get('/customers', { params: { limit: 100 } });
        setCustomers(res.data.data.data);
      } catch (err) {
        console.error(err);
      }
    };
    fetchCustomers();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (account) {
        await api.put(`/starlink-accounts/${account.id}`, formData);
        toast.success('Account updated');
      } else {
        await api.post('/starlink-accounts', formData);
        toast.success('Account created');
      }
      onRefresh();
      onClose();
    } catch (err) {
      toast.error('Failed to save account');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">{account ? 'Edit Account' : 'Add Starlink Account'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Customer *</label>
            <select
              value={formData.customerId}
              onChange={(e) => setFormData({ ...formData, customerId: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
              disabled={!!account}
            >
              <option value="">Select a customer</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName || c.facebookName || c.messengerPsid}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Starlink Email *</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Account Number</label>
            <input
              type="text"
              value={formData.accountNumber}
              onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nickname</label>
            <input
              type="text"
              value={formData.nickname}
              onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="e.g., Home, Office"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isPrimary}
                onChange={(e) => setFormData({ ...formData, isPrimary: e.target.checked })}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Primary Account</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Active</span>
            </label>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
            >
              {submitting ? 'Saving...' : 'Save Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
