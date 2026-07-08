'use client';

import { useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { useModalAnimation } from '@/hooks/useModalAnimation';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { useFormValidation, InputError } from '@/hooks/useFormValidation';
import { Search, Plus, Edit, Trash2, BookOpen, RefreshCw, Loader2, Download, X } from 'lucide-react';
import { Pagination } from '@/components/ui/pagination';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { exportCsv } from '@/lib/csv-export';
import { toast } from 'sonner';
import { Select } from '@/components/ui/select';
import { getErrorMessage } from '@/lib/error-utils';

interface KnowledgeEntry {
  id: string;
  title: string;
  content: string;
  category: string;
  keywords: string[];
  language: string;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

const categories = ['FAQ', 'BILLING', 'PAYMENT', 'POLICY', 'GENERAL', 'STARLINK_INFO'];
const languages = ['EN', 'MY'];

export default function KnowledgeBasePage() {
  const [entries, setEntries] = useState<KnowledgeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 300);
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [languageFilter, setLanguageFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const modalAnim = useModalAnimation(showModal, () => { setShowModal(false); setEditingEntry(null); });

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 50 };
      if (categoryFilter !== 'ALL') params.category = categoryFilter;
      if (languageFilter !== 'ALL') params.language = languageFilter;
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await api.get('/knowledge-base', { params });
      setEntries(res.data.data.data);
      setTotal(res.data.data.total);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [categoryFilter, languageFilter, page, debouncedSearch]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { modalAnim.close(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault();
        setEditingEntry(null);
        setShowModal(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const handleExportCsv = () => {
    exportCsv(
      entries.map(e => ({
        Title: e.title,
        Category: e.category,
        Language: e.language,
        Priority: e.priority,
        Active: e.isActive ? 'Yes' : 'No',
        Keywords: e.keywords.join('; '),
        Updated: formatDate(e.updatedAt),
      })),
      `knowledge-base-${new Date().toISOString().slice(0, 10)}`,
    );
    toast.success('CSV exported');
  };

  const handleDelete = async (id: string) => {
    try {
      await api.delete(`/knowledge-base/${id}`);
      toast.success('Entry deleted');
      fetchEntries();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await api.put(`/knowledge-base/${id}`, { isActive: !isActive });
      toast.success(`Entry ${!isActive ? 'activated' : 'deactivated'}`);
      fetchEntries();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Knowledge Base</h1>
          <p className="text-sm text-foreground opacity-50 mt-1">{total} total entries</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCsv} className="p-2 text-foreground opacity-50 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Export CSV">
            <Download className="w-5 h-5" />
          </button>
          <button onClick={fetchEntries} className="p-2 text-foreground opacity-50 hover:text-primary-600 hover:bg-primary-50 rounded-lg" title="Refresh">
            <RefreshCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => { setEditingEntry(null); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" />
            Add Entry
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground opacity-40" />
          <input
            type="text"
            placeholder="Search knowledge base..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      <div className="flex gap-4">
        <div className="flex gap-2 flex-wrap">
          <Select
            value={categoryFilter}
            onChange={(value) => { setCategoryFilter(value); setPage(1); }}
            options={[
              { value: 'ALL', label: 'All Categories' },
              ...categories.map((c) => ({ value: c, label: c.replace('_', ' ') })),
            ]}
            className="w-44"
          />
          <Select
            value={languageFilter}
            onChange={(value) => { setLanguageFilter(value); setPage(1); }}
            options={[
              { value: 'ALL', label: 'All Languages' },
              ...languages.map((l) => ({ value: l, label: l === 'EN' ? 'English' : 'Myanmar' })),
            ]}
            className="w-36"
          />
        </div>
      </div>

      <ConfirmDialog
        open={!!deleteConfirm}
        title="Delete Entry"
        message="Are you sure you want to delete this entry? This action cannot be undone."
        confirmLabel="Delete"
        variant="danger"
        onConfirm={() => { handleDelete(deleteConfirm!); setDeleteConfirm(null); }}
        onCancel={() => setDeleteConfirm(null)}
      />

      <div className="grid gap-4">
        {loading ? (
          <div className="text-center py-12 text-foreground opacity-50">
            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
            <span>Loading entries...</span>
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-foreground opacity-50">
            <BookOpen className="w-8 h-8 mx-auto mb-2 text-foreground opacity-30 animate-float" />
            <p className="font-medium">No entries found</p>
            <p className="text-xs mt-1">Click "Add Entry" to create one</p>
          </div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="bg-card rounded-xl border border-card-border p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-foreground">{entry.title}</h3>
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      entry.isActive ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    )}>
                      {entry.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-800 rounded text-xs font-medium">
                      {entry.category}
                    </span>
                    <span className="px-2 py-0.5 bg-purple-100 text-purple-800 rounded text-xs font-medium">
                      {entry.language}
                    </span>
                    <span className="text-xs text-foreground opacity-50">Priority: {entry.priority}</span>
                  </div>
                  <p className="text-sm text-foreground opacity-60 line-clamp-3">{entry.content}</p>
                  {entry.keywords.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {entry.keywords.map((kw, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-foreground opacity-60 rounded text-xs">
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-foreground opacity-40 mt-2">
                    Updated {formatDate(entry.updatedAt)}
                  </div>
                </div>
                <div className="flex gap-1 ml-4">
                  <button
                    onClick={() => handleToggleActive(entry.id, entry.isActive)}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded-lg',
                      entry.isActive
                        ? 'bg-gray-100 text-foreground hover:bg-card-hover'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    )}
                  >
                    {entry.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => { setEditingEntry(entry); setShowModal(true); }}
                    className="p-1.5 text-foreground opacity-50 hover:text-primary-600 hover:bg-primary-50 rounded"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(entry.id)}
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
        <KnowledgeEntryModal
          entry={editingEntry}
          onClose={modalAnim.close}
          onRefresh={fetchEntries}
        />
      )}
    </div>
  );
}

function KnowledgeEntryModal({ entry, onClose, onRefresh }: { entry: KnowledgeEntry | null; onClose: () => void; onRefresh: () => void }) {
  const [formData, setFormData] = useState({
    title: entry?.title || '',
    content: entry?.content || '',
    category: entry?.category || 'GENERAL',
    keywords: entry?.keywords?.join(', ') || '',
    language: entry?.language || 'EN',
    priority: entry?.priority || 0,
    isActive: entry?.isActive ?? true,
  });
  const [submitting, setSubmitting] = useState(false);
  const { errors, handleBlur, handleChange, validateAll } = useFormValidation({
    title: { required: 'Title is required' },
    content: { required: 'Content is required' },
  });
  const anim = useModalAnimation(true, onClose);
  const focusTrapRef = useFocusTrap(anim.visible);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateAll({ title: formData.title, content: formData.content })) return;
    setSubmitting(true);
    try {
      const data = {
        ...formData,
        keywords: formData.keywords.split(',').map(k => k.trim()).filter(k => k),
      };

      if (entry) {
        await api.put(`/knowledge-base/${entry.id}`, data);
        toast.success('Entry updated');
      } else {
        await api.post('/knowledge-base', data);
        toast.success('Entry created');
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
      <div className={`bg-card rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 transition-all duration-200 ${anim.closing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">{entry ? 'Edit Entry' : 'Add Entry'}</h2>
          <button onClick={anim.close} aria-label="Close" className="p-2 hover:bg-card-hover rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => { setFormData({ ...formData, title: e.target.value }); handleChange('title', e.target.value); }}
              onBlur={() => handleBlur('title', formData.title)}
              className={`w-full px-3 py-2 border ${errors.title ? 'border-red-400' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
              required
            />
            <InputError error={errors.title} />
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Content *</label>
            <textarea
              value={formData.content}
              onChange={(e) => { setFormData({ ...formData, content: e.target.value }); handleChange('content', e.target.value); }}
              onBlur={() => handleBlur('content', formData.content)}
              rows={6}
              className={`w-full px-3 py-2 border ${errors.content ? 'border-red-400' : 'border-gray-300'} rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent`}
              required
            />
            <InputError error={errors.content} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Category</label>
              <Select
                value={formData.category}
                onChange={(value) => setFormData({ ...formData, category: value })}
                options={categories.map((c) => ({ value: c, label: c.replace('_', ' ') }))}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Language</label>
              <Select
                value={formData.language}
                onChange={(value) => setFormData({ ...formData, language: value })}
                options={languages.map((l) => ({ value: l, label: l === 'EN' ? 'English' : 'Myanmar' }))}
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">Keywords (comma-separated)</label>
            <input
              type="text"
              value={formData.keywords}
              onChange={(e) => setFormData({ ...formData, keywords: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              placeholder="billing, payment, starlink"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">Priority</label>
              <input
                type="number"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="flex items-center">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-foreground">Active</span>
              </label>
            </div>
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
              {submitting ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
