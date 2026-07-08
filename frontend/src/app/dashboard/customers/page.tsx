'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { Search, CheckCircle, XCircle, MessageSquare, UserPlus, Satellite, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { Select } from '@/components/ui/select';

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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [showConversation, setShowConversation] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const fetchCustomers = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 20 };
      if (reviewFilter !== 'ALL') params.reviewStatus = reviewFilter;
      if (search) params.search = search;
      const res = await api.get('/customers', { params });
      setCustomers(res.data.data.data);
      setTotal(res.data.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCustomers(); }, [reviewFilter, page, search]);

  const handleReview = async (id: string, status: 'APPROVED' | 'REJECTED') => {
    try {
      await api.put(`/customers/${id}/review`, {
        reviewStatus: status,
        adminId: 'current-admin',
      });
      toast.success(`Customer ${status === 'APPROVED' ? 'approved' : 'rejected'}`);
      fetchCustomers();
    } catch (err) {
      toast.error('Failed to review customer');
    }
  };

  const handleTakeover = async (id: string) => {
    try {
      await api.put(`/customers/${id}/takeover`, { adminId: 'current-admin' });
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
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <UserPlus className="w-4 h-4" />
          Add Customer
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name, email, PSID, Starlink account..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
              reviewFilter === f ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Starlink Accounts</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Collected By</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Review</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">Loading...</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-500">No customers found</td></tr>
            ) : (
              customers.map((customer) => (
                <tr key={customer.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">{customer.fullName || 'N/A'}</div>
                    <div className="text-xs text-gray-500">{customer.facebookName || ''}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-600">{customer.contactNumber || 'N/A'}</div>
                    <div className="text-xs text-gray-500">{customer.emailAddress || ''}</div>
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
                        <span className="text-xs text-gray-400 ml-1">({customer.starlinkEmail})</span>
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
                      <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        Bot Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => { setSelectedCustomer(customer); setShowConversation(true); }}
                        className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded"
                        title="View Conversation"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </button>
                      {customer.reviewStatus === 'PENDING_REVIEW' && customer.dataCollectedBy === 'bot' && (
                        <>
                          <button
                            onClick={() => handleReview(customer.id, 'APPROVED')}
                            className="p-1.5 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded"
                            title="Approve"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleReview(customer.id, 'REJECTED')}
                            className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Reject"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {customer.isAdminTakeover ? (
                        <button
                          onClick={() => handleRelease(customer.id)}
                          className="px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
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

      {showConversation && selectedCustomer && (
        <ConversationModal
          customer={selectedCustomer}
          onClose={() => { setShowConversation(false); setSelectedCustomer(null); }}
          onRefresh={fetchCustomers}
        />
      )}

      {showDetailModal && selectedCustomer && (
        <CustomerDetailModal
          customer={selectedCustomer}
          onClose={() => { setShowDetailModal(false); setSelectedCustomer(null); }}
          onRefresh={fetchCustomers}
        />
      )}

      {showAddModal && (
        <AddCustomerModal
          onClose={() => setShowAddModal(false)}
          onRefresh={fetchCustomers}
        />
      )}
    </div>
  );
}

function CustomerDetailModal({ customer, onClose, onRefresh }: { customer: Customer; onClose: () => void; onRefresh: () => void }) {
  const [accounts, setAccounts] = useState<StarlinkAccount[]>(customer.starlinkAccounts || []);
  const [loadingAccounts, setLoadingAccounts] = useState(!customer.starlinkAccounts);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [newAccount, setNewAccount] = useState({ accountName: '', accountNumber: '', email: '', password: '', regionPlanId: '', serviceAddress: '', notes: '' });
  const [regionPlans, setRegionPlans] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!customer.starlinkAccounts) {
      const fetchAccounts = async () => {
        try {
          const res = await api.get(`/starlink-accounts/customer/${customer.id}`);
          setAccounts(res.data.data);
        } catch (err) {
          console.error(err);
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
        console.error(err);
      }
    };
    fetchRegionPlans();
  }, [customer.id, customer.starlinkAccounts]);

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
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
    if (!confirm('Delete this Starlink account?')) return;
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
          <div>
            <h2 className="text-xl font-bold">{customer.fullName || customer.facebookName || 'Customer'}</h2>
            <p className="text-sm text-gray-500">PSID: {customer.messengerPsid}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>

        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-500">Full Name</p>
              <p className="font-medium">{customer.fullName || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Facebook Name</p>
              <p className="font-medium">{customer.facebookName || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Contact Number</p>
              <p className="font-medium">{customer.contactNumber || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Email Address</p>
              <p className="font-medium">{customer.emailAddress || 'N/A'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Data Collected By</p>
              <span className={cn(
                'px-2 py-1 rounded-full text-xs font-medium',
                customer.dataCollectedBy === 'bot' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
              )}>
                {customer.dataCollectedBy}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500">Review Status</p>
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
              <p className="text-xs text-gray-500">Billing Requests</p>
              <p className="font-medium">{customer._count?.billingRequests ?? 0}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Conversations</p>
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
                    <label className="block text-xs font-medium text-gray-700 mb-1">Account Name *</label>
                    <input
                      type="text"
                      value={newAccount.accountName}
                      onChange={(e) => setNewAccount({ ...newAccount, accountName: e.target.value })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                      placeholder="e.g., Home Internet"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Account Number *</label>
                    <input
                      type="text"
                      value={newAccount.accountNumber}
                      onChange={(e) => setNewAccount({ ...newAccount, accountNumber: e.target.value })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      required
                      placeholder="e.g., SL-123456"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Account Email</label>
                    <input
                      type="email"
                      value={newAccount.email}
                      onChange={(e) => setNewAccount({ ...newAccount, email: e.target.value })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="user@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Account Password</label>
                    <input
                      type="text"
                      value={newAccount.password}
                      onChange={(e) => setNewAccount({ ...newAccount, password: e.target.value })}
                      className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="Enter password"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Region & Plan</label>
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
                  <label className="block text-xs font-medium text-gray-700 mb-1">Service Address</label>
                  <input
                    type="text"
                    value={newAccount.serviceAddress}
                    onChange={(e) => setNewAccount({ ...newAccount, serviceAddress: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Enter service address"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                  <input
                    type="text"
                    value={newAccount.notes}
                    onChange={(e) => setNewAccount({ ...newAccount, notes: e.target.value })}
                    className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Additional notes"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddAccount(false)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
                  >
                    {submitting ? 'Adding...' : 'Add Account'}
                  </button>
                </div>
              </form>
            )}

            {loadingAccounts ? (
              <div className="text-center py-4 text-gray-500">Loading accounts...</div>
            ) : accounts.length === 0 ? (
              <div className="text-center py-6 text-gray-500 bg-gray-50 rounded-lg">
                <Satellite className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>No Starlink accounts registered</p>
                <p className="text-xs mt-1">Click "Add Account" to register one</p>
              </div>
            ) : (
              <div className="space-y-2">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-gray-200 bg-white"
                  >
                    <div className="flex items-center gap-3">
                      <Satellite className="w-4 h-4 text-gray-400" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{account.accountName}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
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
                        onClick={() => handleDeleteAccount(account.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
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

function ConversationModal({ customer, onClose, onRefresh }: { customer: Customer; onClose: () => void; onRefresh: () => void }) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    const fetchConversations = async () => {
      try {
        const res = await api.get(`/customers/${customer.id}/conversations`);
        setConversations(res.data.data.reverse());
      } catch (err) {
        console.error(err);
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
        adminId: 'current-admin',
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-bold">Conversation with {customer.fullName || customer.facebookName}</h2>
            <p className="text-sm text-gray-500">PSID: {customer.messengerPsid}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-3">
          {loading ? (
            <div className="text-center text-gray-500">Loading conversations...</div>
          ) : conversations.length === 0 ? (
            <div className="text-center text-gray-500">No conversations yet</div>
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
                    ? 'bg-gray-100 text-gray-900'
                    : conv.isAdminTakeover
                      ? 'bg-purple-100 text-purple-900'
                      : 'bg-primary-100 text-primary-900'
                )}>
                  <div className="text-sm">{conv.content}</div>
                  <div className="text-xs text-gray-500 mt-1">
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
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              <button
                onClick={sendMessage}
                disabled={sending || !message.trim()}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {sending ? 'Sending...' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddCustomerModal({ onClose, onRefresh }: { onClose: () => void; onRefresh: () => void }) {
  const [formData, setFormData] = useState({
    fullName: '',
    facebookName: '',
    contactNumber: '',
    emailAddress: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/customers', { ...formData, adminId: 'current-admin' });
      toast.success('Customer created');
      onRefresh();
      onClose();
    } catch (err) {
      toast.error('Failed to create customer');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Add Customer</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
            <input
              type="text"
              value={formData.fullName}
              onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Facebook Name</label>
            <input
              type="text"
              value={formData.facebookName}
              onChange={(e) => setFormData({ ...formData, facebookName: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Contact Number</label>
            <input
              type="text"
              value={formData.contactNumber}
              onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <input
              type="email"
              value={formData.emailAddress}
              onChange={(e) => setFormData({ ...formData, emailAddress: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
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
              {submitting ? 'Creating...' : 'Create Customer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
