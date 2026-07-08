'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Save, Key, MessageSquare, Bot, HardDrive, Globe } from 'lucide-react';
import { Select } from '@/components/ui/select';

interface SettingGroup {
  category: string;
  label: string;
  icon: any;
  fields: { key: string; label: string; type: string; description?: string }[];
}

const settingGroups: SettingGroup[] = [
  {
    category: 'ai',
    label: 'AI Settings',
    icon: Bot,
    fields: [
      { key: 'gemini_api_key', label: 'Gemini API Key', type: 'password', description: 'Google Gemini API key' },
      { key: 'gemini_model', label: 'Gemini Model', type: 'text', description: 'e.g., gemini-2.5-flash' },
      { key: 'temperature', label: 'Temperature', type: 'number', description: '0.0 - 1.0' },
      { key: 'max_output_tokens', label: 'Max Output Tokens', type: 'number' },
      { key: 'system_prompt', label: 'System Prompt', type: 'textarea' },
    ],
  },
  {
    category: 'facebook',
    label: 'Facebook Settings',
    icon: MessageSquare,
    fields: [
      { key: 'page_access_token', label: 'Page Access Token', type: 'password' },
      { key: 'verify_token', label: 'Verify Token', type: 'password' },
      { key: 'app_secret', label: 'App Secret', type: 'password' },
    ],
  },
  {
    category: 'telegram',
    label: 'Telegram Settings',
    icon: Key,
    fields: [
      { key: 'bot_token', label: 'Bot Token', type: 'password' },
      { key: 'admin_chat_id', label: 'Admin Chat ID', type: 'text' },
      { key: 'enabled', label: 'Enable Notifications', type: 'select', description: 'true or false' },
    ],
  },
  {
    category: 'storage',
    label: 'Storage Settings',
    icon: HardDrive,
    fields: [
      { key: 'upload_dir', label: 'Upload Directory', type: 'text' },
      { key: 'max_file_size', label: 'Max File Size (bytes)', type: 'number' },
      { key: 'allowed_file_types', label: 'Allowed File Types', type: 'text' },
    ],
  },
  {
    category: 'general',
    label: 'General Settings',
    icon: Globe,
    fields: [
      { key: 'company_name', label: 'Company Name', type: 'text' },
      { key: 'support_contact', label: 'Support Contact', type: 'text' },
      { key: 'timezone', label: 'Time Zone', type: 'text' },
      { key: 'language', label: 'Default Language', type: 'select' },
    ],
  },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('ai');
  const [settings, setSettings] = useState<Record<string, any[]>>({});
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await api.get('/settings');
        const data = res.data.data;
        setSettings(data);
        const values: Record<string, string> = {};
        Object.entries(data).forEach(([cat, items]) => {
          (items as any[]).forEach((item) => {
            values[`${cat}:${item.key}`] = item.value;
          });
        });
        setEditValues(values);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const group = settingGroups.find(g => g.category === activeTab);
      if (!group) return;
      const updates: Record<string, string> = {};
      group.fields.forEach(f => {
        const val = editValues[`${activeTab}:${f.key}`];
        if (val !== undefined) {
          const isMasked = /^[•*\u2022]+$/.test(val);
          if (!isMasked) {
            updates[f.key] = val;
          }
        }
      });
      await api.put(`/settings/${activeTab}`, updates);
      toast.success('Settings saved successfully');
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const activeGroup = settingGroups.find(g => g.category === activeTab);

  if (loading) return <div className="text-center py-12 text-gray-500">Loading settings...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      <div className="flex gap-6">
        <div className="w-56 space-y-1">
          {settingGroups.map((group) => {
            const Icon = group.icon;
            return (
              <button
                key={group.category}
                onClick={() => setActiveTab(group.category)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === group.category ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Icon className="w-4 h-4" />
                {group.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-6">{activeGroup?.label}</h2>

          <div className="space-y-4">
            {activeGroup?.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                {field.type === 'textarea' ? (
                  <textarea
                    value={editValues[`${activeTab}:${field.key}`] || ''}
                    onChange={(e) => setEditValues({ ...editValues, [`${activeTab}:${field.key}`]: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  />
                ) : field.type === 'select' ? (
                  <Select
                    value={editValues[`${activeTab}:${field.key}`] || ''}
                    onChange={(value) => setEditValues({ ...editValues, [`${activeTab}:${field.key}`]: value })}
                    options={
                      field.key === 'language'
                        ? [
                            { value: 'EN', label: 'English' },
                            { value: 'MY', label: 'Myanmar' },
                          ]
                        : [
                            { value: 'true', label: 'Enabled' },
                            { value: 'false', label: 'Disabled' },
                          ]
                    }
                  />
                ) : (
                  <input
                    type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
                    value={editValues[`${activeTab}:${field.key}`] || ''}
                    onChange={(e) => setEditValues({ ...editValues, [`${activeTab}:${field.key}`]: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  />
                )}
                {field.description && <p className="text-xs text-gray-400 mt-1">{field.description}</p>}
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
