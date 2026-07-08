'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { useModalAnimation } from '@/hooks/useModalAnimation';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useFormValidation, InputError } from '@/hooks/useFormValidation';
import { Search, Plus, Edit, Trash2, Globe, DollarSign, RefreshCw, Loader2, Download, X } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { exportCsv } from '@/lib/csv-export';
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
  const debouncedSearch = useDebounce(search, 300);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingRegionPlan, setEditingRegionPlan] = useState<RegionPlan | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const modalAnim = useModalAnimation(showModal, () => { setShowModal(false); setEditingRegionPlan(null); });
  const fetchRegionPlans = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 50 };
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await api.get('/region-plan', { params });
      setRegionPlans(res.data.data.data);
      setTotal(res.data.data.total);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    fetchRegionPlans();
  }, [fetchRegionPlans]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { modalAnim.close(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setEditingRegionPlan(null);
        setShowModal(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleExportCsv = () => {
    exportCsv(
      regionPlans.map(rp => ({
        Region: rp.region,
        Plan: rp.plan,
        Description: rp.description || '',
        Price: rp.price || '',
        Currency: rp.currency,
        Active: rp.isActive ? 'Yes' : 'No',
        Updated: formatDate(rp.updatedAt),
      })),
      `region-plans-${new Date().toISOString().slice(0, 10)}`,
    );
    toast.success('CSV exported');
  };

  const handleDelete = async (id: string) => {
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
          <h1 className="text-2xl font-bold text-foreground">Starlink Regions & Plans</h1>
          <p className="text-sm text-foreground opacity-50 mt-1">{total} total plans</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCsv} className="p-2 text-foreground opacity-50 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Export CSV">
            <Download className="w-5 h-5" />
          </button>
          <button onClick={fetchRegionPlans} className="p-2 text-foreground opacity-50 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Refresh">
            <RefreshCw className="w-5 h-5" />
          </button>
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
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground opacity-40" />
          <input
            type="text"
            placeholder="Search by region or plan..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Region & Plan"
        message="Are you sure you want to delete this region and plan? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { handleDelete(deleteConfirm!); setDeleteConfirm(null); }}
        onCancel={() => setDeleteConfirm(null)}
      />

      <div className="grid gap-4">
        {loading ? (
          <div className="text-center py-12 text-foreground opacity-50">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <span>Loading regions and plans...</span>
          </div>
        ) : regionPlans.length === 0 ? (
          <div className="text-center py-12 text-foreground opacity-50">
            <Globe className="w-8 h-8 mx-auto mb-2 text-foreground opacity-30 animate-float" />
            <p className="font-medium">No regions and plans found</p>
            <p className="text-xs mt-1">Click "Add Region & Plan" to create one</p>
          </div>
        ) : (
          regionPlans.map((rp) => (
            <div key={rp.id} className="bg-card rounded-xl border border-card-border p-6 hover:shadow-md transition-shadow">                    
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="w-5 h-5 text-primary-600" />
                    <h3 className="text-lg font-semibold text-foreground">{rp.region}</h3>
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      rp.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    )}>
                      {rp.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-sm font-medium">
                      {rp.plan}
                    </span>
                    {rp.price && (
                      <span className="flex items-center gap-1 text-sm text-foreground opacity-60">
                        <DollarSign className="w-4 h-4" />
                        {rp.price} {getCurrencyName(rp.currency)}/month
                      </span>
                    )}
                  </div>
                  {rp.description && (
                    <p className="text-sm text-foreground opacity-60">{rp.description}</p>
                  )}
                  <div className="text-xs text-foreground opacity-40 mt-2">
                    Updated {formatDate(rp.updatedAt)}
                  </div>
                </div>
                <div className="flex gap-1 ml-4">
                  <button
                    onClick={() => handleToggleActive(rp.id, rp.isActive)}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded-lg',
                      rp.isActive
                        ? 'bg-gray-100 text-foreground hover:bg-card-hover'
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
                    className="p-1.5 text-foreground opacity-50 hover:text-primary-600 hover:bg-primary-50 rounded"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(rp.id)}
                    className="p-1.5 text-foreground opacity-50 hover:text-red-600 hover:bg-red-50 rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <Pagination page={page} total={total} limit={50} onPageChange={setPage} />

      {modalAnim.visible && (
        <RegionPlanModal
          regionPlan={editingRegionPlan}
          onClose={modalAnim.close}
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
  const { errors, handleBlur, handleChange, validateAll } = useFormValidation({
    region: { required: 'Region is required' },
    plan: { required: 'Plan is required' },
    currency: { required: 'Currency is required' },
  });
  const anim = useModalAnimation(true, onClose);
  const focusTrapRef = useFocusTrap(anim.visible);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll({ region: formData.region, plan: formData.plan, currency: formData.currency })) return;
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
    <div ref={focusTrapRef} role="dialog" aria-modal="true" className={`fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 transition-opacity duration-200 ${anim.closing ? 'opacity-0' : 'opacity-100'}`} onClick={anim.close}>
      <div className={`bg-card rounded-2xl max-w-md w-full p-6 transition-all duration-200 ${anim.closing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">{regionPlan ? 'Edit Region & Plan' : 'Add Region & Plan'}</h2>
          <button onClick={anim.close} aria-label="Close" className="p-2 hover:bg-card-hover rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Region *</label>
            <input
              type="text"
              value={formData.region}
              onChange={(e) => { setFormData({ ...formData, region: e.target.value }); handleChange('region', e.target.value); }}
              onBlur={() => handleBlur('region', formData.region)}
              className={`w-full px-3 py-2 border ${errors.region ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
              required
              placeholder="e.g., United States, Europe, Asia"
            />
            <InputError error={errors.region} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Plan Name *</label>
            <input
              type="text"
              value={formData.plan}
              onChange={(e) => { setFormData({ ...formData, plan: e.target.value }); handleChange('plan', e.target.value); }}
              onBlur={() => handleBlur('plan', formData.plan)}
              className={`w-full px-3 py-2 border ${errors.plan ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'} rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
              required
              placeholder="e.g., Residential Standard, Business Priority"
            />
            <InputError error={errors.plan} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Description</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="Plan description and features"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Monthly Price</label>
              <input
                type="number"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Currency</label>
              <CurrencyDropdown
                value={formData.currency}
                onChange={(value) => { setFormData({ ...formData, currency: value }); handleChange('currency', value); }}
              />
              <InputError error={errors.currency} />
            </div>
          </div>
          <div className="flex items-center">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="w-4 h-4 text-primary-600 border-gray-300 dark:border-gray-600 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-foreground">Active</span>
            </label>
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
              {submitting ? 'Saving...' : 'Save Region & Plan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
