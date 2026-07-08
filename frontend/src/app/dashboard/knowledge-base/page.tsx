'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { formatDate, cn } from '@/lib/utils';
import { Search, Plus, Edit, Trash2, BookOpen } from 'lucide-react';
import { toast } from 'sonner';

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
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [languageFilter, setLanguageFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<KnowledgeEntry | null>(null);

  const fetchEntries = async () => {
    setLoading(true);
    try {
      const params: any = { page, limit: 50 };
      if (categoryFilter !== 'ALL') params.category = categoryFilter;
      if (languageFilter !== 'ALL') params.language = languageFilter;
      if (search) params.search = search;
      const res = await api.get('/knowledge-base', { params });
      setEntries(res.data.data.data);
      setTotal(res.data.data.total);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEntries(); }, [categoryFilter, languageFilter, page, search]);

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    try {
      await api.delete(`/knowledge-base/${id}`);
      toast.success('Entry deleted');
      fetchEntries();
    } catch (err) {
      toast.error('Failed to delete entry');
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      await api.put(`/knowledge-base/${id}`, { isActive: !isActive });
      toast.success(`Entry ${!isActive ? 'activated' : 'deactivated'}`);
      fetchEntries();
    } catch (err) {
      toast.error('Failed to update entry');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Knowledge Base</h1>
        <button
          onClick={() => { setEditingEntry(null); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
        >
          <Plus className="w-4 h-4" />
          Add Entry
        </button>
      </div>

      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
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
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          >
            <option value="ALL">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            value={languageFilter}
            onChange={(e) => { setLanguageFilter(e.target.value); setPage(1); }}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
          >
            <option value="ALL">All Languages</option>
            {languages.map(l => <option key={l} value={l}>{l}</option>)}
          </select>
        </div>
      </div>

      <div className="grid gap-4">
        {loading ? (
          <div className="text-center py-12 text-gray-500">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="text-center py-12 text-gray-500">No entries found</div>
        ) : (
          entries.map((entry) => (
            <div key={entry.id} className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900">{entry.title}</h3>
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-xs font-medium',
                      entry.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
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
                    <span className="text-xs text-gray-500">Priority: {entry.priority}</span>
                  </div>
                  <p className="text-sm text-gray-600 line-clamp-3">{entry.content}</p>
                  {entry.keywords.length > 0 && (
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {entry.keywords.map((kw, i) => (
                        <span key={i} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                          {kw}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-gray-400 mt-2">
                    Updated {formatDate(entry.updatedAt)}
                  </div>
                </div>
                <div className="flex gap-1 ml-4">
                  <button
                    onClick={() => handleToggleActive(entry.id, entry.isActive)}
                    className={cn(
                      'px-3 py-1.5 text-xs rounded-lg',
                      entry.isActive
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    )}
                  >
                    {entry.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => { setEditingEntry(entry); setShowModal(true); }}
                    className="p-1.5 text-gray-500 hover:text-primary-600 hover:bg-primary-50 rounded"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(entry.id)}
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
        <KnowledgeEntryModal
          entry={editingEntry}
          onClose={() => { setShowModal(false); setEditingEntry(null); }}
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      toast.error('Failed to save entry');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">{entry ? 'Edit Entry' : 'Add Entry'}</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content *</label>
            <textarea
              value={formData.content}
              onChange={(e) => setFormData({ ...formData, content: e.target.value })}
              rows={6}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
              <select
                value={formData.language}
                onChange={(e) => setFormData({ ...formData, language: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {languages.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Keywords (comma-separated)</label>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
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
                <span className="text-sm font-medium text-gray-700">Active</span>
              </label>
            </div>
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
              {submitting ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
