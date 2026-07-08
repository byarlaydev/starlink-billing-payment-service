'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { Search, Plus, Edit, Trash2, Globe, DollarSign, Loader2 } from 'lucide-react';
import { CurrencyDropdown, getCurrencyName } from '@/components/ui/currency-dropdown';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error-utils';

interface RegionPlan {
  id: string;
  region: string;
  plan: string;
  description: string | null;
  price: number | null;
  currency: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function RegionPlanPage() {
  const [regionPlans, setRegionPlans] = useState<RegionPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingRegionPlan, setEditingRegionPlan] = useState<RegionPlan | null>(null);
  const fetchRegionPlans = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 50 };
      if (search) params.search = search;
      const res = await api.get('/region-plan', { params });
      setRegionPlans(res.data.data.data);
      setTotal(res.data.data.total);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRegionPlans();
  }, [page, search]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this region and plan?')) return;
    try {
      await api.delete(`/region-plan/${id}`);
      toast.success('Region and plan has been deleted.');
      fetchRegionPlans();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await api.put(`/region-plan/${id}`, { isActive: !isActive });
      toast.success(`Region and plan has been ${!isActive ? 'activated' : 'deactivated'}.`);
      fetchRegionPlans();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Starlink Regions & Plans</h1>
          <p className="text-sm text-gray-500 mt-1">Manage Starlink regions and subscription plans</p>
        </div>
        <button
          onClick={() => {
            setEditingRegionPlan(null);
            setShowModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          Add Region & Plan
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by region or plan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="text-center py-12 text-gray-500">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <span>Loading regions and plans...</span>
          </div>
        ) : regionPlans.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Globe className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p className="font-medium">No regions and plans found</p>
            <p className="text-xs mt-1">Click "Add Region & Plan" to create one</p>
          </div>
        ) : (
          regionPlans.map((rp) => (
            <div key={rp.id} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="w-5 h-5 text-primary-600" />
                    <h3 className="text-lg font-semibold text-gray-900">{rp.region}</h3>
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      rp.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    )}>
                      {rp.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                      {rp.plan}
                    </span>
                    {rp.price && (
                      <span className="flex items-center gap-1 text-sm text-gray-600">
                        <DollarSign className="w-4 h-4" />
                        {rp.price} {getCurrencyName(rp.currency)}/month
                      </span>
                    )}
                  </div>
                  {rp.description && (
                    <p className="text-sm text-gray-600">{rp.description}</p>
                  )}
                  <div className="text-xs text-gray-400 mt-2">
                    Updated {formatDate(rp.updatedAt)}
                  </div>
                </div>
                <div className="flex gap-1 ml-4">
                  <button
                    onClick={() => handleToggleActive(rp.id, rp.isActive)}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded-lg',
                      rp.isActive
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    )}
                  >
                    {rp.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => {
                      setEditingRegionPlan(rp);
                      setShowModal(true);
                    }}
                    className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(rp.id)}
                    className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {total > 50 && (
        <div className="flex items-center justify-between">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50"
          >
            Previous
          </button>
          <span className="text-sm text-gray-500">Page {page} of {Math.ceil(total / 50)}</span>
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={page >= Math.ceil(total / 50)}
            className="px-4 py-2 text-sm border rounded-lg disabled:opacity-50"
          >
            Next
          </button>
        </div>
      )}

      {showModal && (
        <RegionPlanModal
          regionPlan={editingRegionPlan}
          onClose={() => {
            setShowModal(false);
            setEditingRegionPlan(null);
          }}
          onRefresh={fetchRegionPlans}
        />
      )}
    </div>
  );
}

function RegionPlanModal({
  regionPlan,
  onClose,
  onRefresh,
}: {
  regionPlan: RegionPlan | null;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [formData, setFormData] = useState({
    region: regionPlan?.region || '',
    plan: regionPlan?.plan || '',
    description: regionPlan?.description || '',
    price: regionPlan?.price || '',
    currency: regionPlan?.currency || 'USD',
    isActive: regionPlan?.isActive ?? true,
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const submitData: Record<string, any> = {
        ...formData,
        price: formData.price ? parseFloat(formData.price as string) : undefined,
      };
      if (regionPlan) {
        await api.put(`/region-plan/${regionPlan.id}`, submitData);
        toast.success('Region and plan has been updated.');
      } else {
        const { isActive, ...createData } = submitData;
        await api.post('/region-plan', createData);
        toast.success('Region and plan has been created.');
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">{regionPlan ? 'Edit Region & Plan' : 'Add Region & Plan'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Region *</label>
            <input
              type="text"
              value={formData.region}
              onChange={(e) => setFormData({ ...formData, region: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
              placeholder="e.g., United States, Europe, Asia"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plan Name *</label>
            <input
              type="text"
              value={formData.plan}
              onChange={(e) => setFormData({ ...formData, plan: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
              placeholder="e.g., Residential Standard, Business Priority"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Plan description and features"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Price</label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Currency</label>
              <CurrencyDropdown
                value={formData.currency}
                onChange={(value) => setFormData({ ...formData, currency: value })}
              />
            </div>
          </div>
          <div className="flex items-center">
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
              {submitting ? 'Saving...' : 'Save Region & Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
