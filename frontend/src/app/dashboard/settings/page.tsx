'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error-utils';
import { Save, Key, MessageSquare, Bot, HardDrive, Globe, Loader2, RefreshCw, Radio } from 'lucide-react';
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
    category: 'messenger',
    label: 'Messenger Provider',
    icon: Radio,
    fields: [
      { key: 'provider', label: 'Active Provider', type: 'select', description: 'Choose how to connect to Messenger' },
      { key: 'invent_api_key', label: 'UseInvent API Key', type: 'password', description: 'API key from useinvent.com' },
      { key: 'invent_org_id', label: 'UseInvent Org ID', type: 'text', description: 'Your organization ID in UseInvent' },
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
  const [pollingStatus, setPollingStatus] = useState<any>(null);
  const [restarting, setRestarting] = useState(false);

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
        toast.error(getErrorMessage(err));
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

  useEffect(() => {
    if (activeTab === 'messenger') {
      api.get('/settings/messenger/polling/status')
        .then(res => setPollingStatus(res.data.data))
        .catch(() => {});
    }
  }, [activeTab]);

  const handleRestartPolling = async () => {
    setRestarting(true);
    try {
      await api.post('/settings/messenger/polling/restart');
      toast.success('Polling service restarted');
      const res = await api.get('/settings/messenger/polling/status');
      setPollingStatus(res.data.data);
    } catch {
      toast.error('Failed to restart polling');
    } finally {
      setRestarting(false);
    }
  };

  if (loading) return <div className="text-center py-12 text-foreground opacity-50">Loading settings...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Settings</h1>

      <div className="flex gap-6">
        <div className="w-56 space-y-1">
          {settingGroups.map((group) => {
            const Icon = group.icon;
            return (
              <button
                key={group.category}
                onClick={() => setActiveTab(group.category)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === group.category ? 'bg-primary-50 text-primary-700' : 'text-foreground opacity-60 hover:bg-card-hover'
                }`}
              >
                <Icon className="w-4 h-4" />
                {group.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 bg-card rounded-xl border border-card-border p-6">
          <h2 className="text-lg font-semibold mb-6">{activeGroup?.label}</h2>

          <div className="space-y-4">
            {activeGroup?.fields.map((field) => (
              <div key={field.key}>
                <label className="block text-sm font-medium text-foreground mb-1">{field.label}</label>
                {field.type === 'textarea' ? (
                  <textarea
                    value={editValues[`${activeTab}:${field.key}`] || ''}
                    onChange={(e) => setEditValues({ ...editValues, [`${activeTab}:${field.key}`]: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
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
                        : field.key === 'provider'
                        ? [
                            { value: 'facebook', label: 'Facebook (Webhook)' },
                            { value: 'invent', label: 'UseInvent (API Polling)' },
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
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                  />
                )}
                {field.description && <p className="text-xs text-foreground opacity-40 mt-1">{field.description}</p>}
              </div>
            ))}
          </div>

          <div className="mt-6 pt-4 border-t">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>

          {activeTab === 'messenger' && (
            <div className="mt-6 pt-4 border-t border-card-border">
              <h3 className="text-sm font-semibold text-foreground mb-3">Polling Service Status</h3>
              <div className="flex items-center justify-between p-3 bg-card-hover rounded-lg">
                <div>
                  <p className="text-sm text-foreground">
                    Last poll: {pollingStatus?.lastPollTime
                      ? new Date(pollingStatus.lastPollTime).toLocaleString()
                      : 'Never (service inactive)'}
                  </p>
                  <p className="text-xs text-foreground opacity-50 mt-0.5">
                    Polls every 10 seconds when provider is set to UseInvent
                  </p>
                </div>
                <button
                  onClick={handleRestartPolling}
                  disabled={restarting}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 disabled:opacity-50"
                >
                  {restarting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                  Restart
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
