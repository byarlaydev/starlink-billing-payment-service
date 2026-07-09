'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { getErrorMessage } from '@/lib/error-utils';
import { Save, Key, MessageSquare, Bot, HardDrive, Globe, Loader2, RefreshCw, CheckCircle2, Circle, Clock, Play } from 'lucide-react';
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
    category: 'messenger',
    label: 'Messenger',
    icon: MessageSquare,
    fields: [],
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

const facebookFields = [
  { key: 'page_access_token', label: 'Page Access Token', type: 'password', description: 'Long-lived token from Facebook Graph API Explorer' },
  { key: 'verify_token', label: 'Verify Token', type: 'password', description: 'Custom token you set in Facebook webhook config' },
  { key: 'app_secret', label: 'App Secret', type: 'password', description: 'From your Facebook App settings' },
];

const inventFields = [
  { key: 'invent_api_key', label: 'API Key', type: 'password', description: 'Generate at useinvent.com/o/settings/api-keys' },
  { key: 'invent_org_id', label: 'Organization ID', type: 'text', description: 'Use "c" for your main org, or the sub-org ID' },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState('ai');
  const [settings, setSettings] = useState<Record<string, any[]>>({});
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pollingStatus, setPollingStatus] = useState<any>(null);
  const [restarting, setRestarting] = useState(false);
  const [autoResolveStatus, setAutoResolveStatus] = useState<any>(null);
  const [runningAutoResolve, setRunningAutoResolve] = useState(false);

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
      if (activeTab === 'messenger') {
        const messengerUpdates: Record<string, string> = {};
        const providerVal = editValues['messenger:provider'];
        if (providerVal !== undefined && !/^[•*\u2022]+$/.test(providerVal)) {
          messengerUpdates.provider = providerVal;
        }
        const autoResolveEnabled = editValues['messenger:auto_resolve_enabled'];
        if (autoResolveEnabled !== undefined) {
          messengerUpdates.auto_resolve_enabled = autoResolveEnabled;
        }
        const autoResolveHours = editValues['messenger:auto_resolve_hours'];
        if (autoResolveHours !== undefined && !/^[•*\u2022]+$/.test(autoResolveHours)) {
          messengerUpdates.auto_resolve_hours = autoResolveHours;
        }
        inventFields.forEach(f => {
          const val = editValues[`messenger:${f.key}`];
          if (val !== undefined && !/^[•*\u2022]+$/.test(val)) {
            messengerUpdates[f.key] = val;
          }
        });
        await api.put('/settings/messenger', messengerUpdates);

        const fbUpdates: Record<string, string> = {};
        facebookFields.forEach(f => {
          const val = editValues[`facebook:${f.key}`];
          if (val !== undefined && !/^[•*\u2022]+$/.test(val)) {
            fbUpdates[f.key] = val;
          }
        });
        if (Object.keys(fbUpdates).length > 0) {
          await api.put('/settings/facebook', fbUpdates);
        }

        toast.success('Messenger settings saved');
      } else {
        const group = settingGroups.find(g => g.category === activeTab);
        if (!group) return;
        const updates: Record<string, string> = {};
        group.fields.forEach(f => {
          const val = editValues[`${activeTab}:${f.key}`];
          if (val !== undefined && !/^[•*\u2022]+$/.test(val)) {
            updates[f.key] = val;
          }
        });
        await api.put(`/settings/${activeTab}`, updates);
        toast.success('Settings saved successfully');
      }
    } catch {
      toast.error('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const activeGroup = settingGroups.find(g => g.category === activeTab);
  const activeProvider = editValues['messenger:provider'] || 'facebook';

  useEffect(() => {
    if (activeTab === 'messenger') {
      api.get('/settings/messenger/polling/status')
        .then(res => setPollingStatus(res.data.data))
        .catch(() => {});
      api.get('/settings/messenger/auto-resolve/status')
        .then(res => setAutoResolveStatus(res.data.data))
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

  const handleRunAutoResolve = async () => {
    setRunningAutoResolve(true);
    try {
      const res = await api.post('/settings/messenger/auto-resolve/run');
      const { resolved } = res.data.data;
      toast.success(resolved > 0 ? `Auto-resolved ${resolved} conversation${resolved > 1 ? 's' : ''}` : 'No stale conversations to resolve');
      const statusRes = await api.get('/settings/messenger/auto-resolve/status');
      setAutoResolveStatus(statusRes.data.data);
    } catch {
      toast.error('Failed to run auto-resolve');
    } finally {
      setRunningAutoResolve(false);
    }
  };

  const renderField = (field: { key: string; label: string; type: string; description?: string }, category: string) => (
    <div key={`${category}:${field.key}`}>
      <label className="block text-sm font-medium text-foreground mb-1">{field.label}</label>
      {field.type === 'textarea' ? (
        <textarea
          value={editValues[`${category}:${field.key}`] || ''}
          onChange={(e) => setEditValues({ ...editValues, [`${category}:${field.key}`]: e.target.value })}
          rows={4}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
        />
      ) : field.type === 'select' ? (
        <Select
          value={editValues[`${category}:${field.key}`] || ''}
          onChange={(value) => setEditValues({ ...editValues, [`${category}:${field.key}`]: value })}
          options={
            field.key === 'language'
              ? [{ value: 'EN', label: 'English' }, { value: 'MY', label: 'Myanmar' }]
              : [{ value: 'true', label: 'Enabled' }, { value: 'false', label: 'Disabled' }]
          }
        />
      ) : (
        <input
          type={field.type === 'password' ? 'password' : field.type === 'number' ? 'number' : 'text'}
          value={editValues[`${category}:${field.key}`] || ''}
          onChange={(e) => setEditValues({ ...editValues, [`${category}:${field.key}`]: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
        />
      )}
      {field.description && <p className="text-xs text-foreground opacity-40 mt-1">{field.description}</p>}
    </div>
  );

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
          {activeTab === 'messenger' ? (
            <div className="space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Messenger</h2>
                <p className="text-sm text-foreground opacity-50 mt-1">Connect to Facebook Messenger via webhook or UseInvent API polling</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-3">Connection Method</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setEditValues({ ...editValues, 'messenger:provider': 'facebook' })}
                    className={`relative flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left ${
                      activeProvider === 'facebook'
                        ? 'border-primary-500 bg-primary-50/50'
                        : 'border-card-border hover:border-primary-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {activeProvider === 'facebook'
                        ? <CheckCircle2 className="w-5 h-5 text-primary-600" />
                        : <Circle className="w-5 h-5 text-foreground opacity-30" />}
                      <span className="text-sm font-semibold text-foreground">Facebook Webhook</span>
                    </div>
                    <p className="text-xs text-foreground opacity-50">
                      Receive messages in real-time via Facebook webhook. Requires a public URL and Facebook App setup.
                    </p>
                  </button>

                  <button
                    onClick={() => setEditValues({ ...editValues, 'messenger:provider': 'invent' })}
                    className={`relative flex flex-col items-start p-4 rounded-xl border-2 transition-all text-left ${
                      activeProvider === 'invent'
                        ? 'border-primary-500 bg-primary-50/50'
                        : 'border-card-border hover:border-primary-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      {activeProvider === 'invent'
                        ? <CheckCircle2 className="w-5 h-5 text-primary-600" />
                        : <Circle className="w-5 h-5 text-foreground opacity-30" />}
                      <span className="text-sm font-semibold text-foreground">UseInvent API</span>
                    </div>
                    <p className="text-xs text-foreground opacity-50">
                      Poll messages from UseInvent every 10 seconds. No webhook needed — just an API key.
                    </p>
                  </button>
                </div>
              </div>

              {activeProvider === 'facebook' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-card-border" />
                    <span className="text-xs font-medium text-foreground opacity-40 uppercase tracking-wide">Facebook Credentials</span>
                    <div className="h-px flex-1 bg-card-border" />
                  </div>
                  {facebookFields.map(f => renderField(f, 'facebook'))}
                </div>
              )}

              {activeProvider === 'invent' && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-card-border" />
                    <span className="text-xs font-medium text-foreground opacity-40 uppercase tracking-wide">UseInvent Credentials</span>
                    <div className="h-px flex-1 bg-card-border" />
                  </div>
                  {inventFields.map(f => renderField(f, 'messenger'))}

                  <div className="mt-4 p-4 bg-card-hover rounded-xl">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Polling Service</p>
                        <p className="text-xs text-foreground opacity-50 mt-0.5">
                          Last poll: {pollingStatus?.lastPollTime
                            ? new Date(pollingStatus.lastPollTime).toLocaleString()
                            : 'Not started yet'}
                        </p>
                      </div>
                      <button
                        onClick={handleRestartPolling}
                        disabled={restarting}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 disabled:opacity-50 transition-colors"
                      >
                        {restarting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                        Restart
                      </button>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="h-px flex-1 bg-card-border" />
                  <span className="text-xs font-medium text-foreground opacity-40 uppercase tracking-wide">Auto-Resolve</span>
                  <div className="h-px flex-1 bg-card-border" />
                </div>
                <p className="text-xs text-foreground opacity-50">
                  Automatically close stale conversations after a period of inactivity. Sends a friendly farewell message and resets the conversation state.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Enable Auto-Resolve</label>
                    <Select
                      value={editValues['messenger:auto_resolve_enabled'] || 'false'}
                      onChange={(value) => setEditValues({ ...editValues, 'messenger:auto_resolve_enabled': value })}
                      options={[
                        { value: 'true', label: 'Enabled' },
                        { value: 'false', label: 'Disabled' },
                      ]}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-foreground mb-1">Inactivity Threshold (hours)</label>
                    <input
                      type="number"
                      min="1"
                      max="720"
                      value={editValues['messenger:auto_resolve_hours'] || '24'}
                      onChange={(e) => setEditValues({ ...editValues, 'messenger:auto_resolve_hours': e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                    />
                    <p className="text-xs text-foreground opacity-40 mt-1">Conversations inactive longer than this will be closed</p>
                  </div>
                </div>
                <div className="p-4 bg-card-hover rounded-xl">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Clock className="w-4 h-4 text-foreground opacity-40" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Auto-Resolve Status</p>
                        <p className="text-xs text-foreground opacity-50 mt-0.5">
                          Last run: {autoResolveStatus?.lastRunTime
                            ? `${new Date(autoResolveStatus.lastRunTime).toLocaleString()} — resolved ${autoResolveStatus.lastResolvedCount || 0}`
                            : 'Never run'}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleRunAutoResolve}
                      disabled={runningAutoResolve}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100 disabled:opacity-50 transition-colors"
                    >
                      {runningAutoResolve ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                      Run Now
                    </button>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-card-border">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-lg font-semibold mb-6">{activeGroup?.label}</h2>

              <div className="space-y-4">
                {activeGroup?.fields.map((field) => renderField(field, activeTab))}
              </div>

              <div className="mt-6 pt-4 border-t border-card-border">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
