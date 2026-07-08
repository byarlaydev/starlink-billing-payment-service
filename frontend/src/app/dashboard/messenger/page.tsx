'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatDate, cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/error-utils';
import { StatusDialog } from '@/components/ui/status-dialog';
import { Search, Send, MessageSquare, Phone, Mail, Globe, Bot, UserCheck, UserX, Loader2 } from 'lucide-react';

interface Customer {
  id: string;
  messengerPsid: string;
  fullName: string | null;
  facebookName: string | null;
  contactNumber: string | null;
  emailAddress: string | null;
  preferredLang: string;
  isActive: boolean;
  isAdminTakeover: boolean;
  takeoverAdminId: string | null;
  conversationState: string;
  _count: { conversations: number };
}

interface Conversation {
  id: string;
  direction: string;
  messageType: string;
  content: string;
  isAdminTakeover: boolean;
  adminId: string | null;
  createdAt: string;
}

export default function MessengerPage() {
  const user = useAuthStore((s) => s.user);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [statusDialog, setStatusDialog] = useState<{
    open: boolean; type: 'success' | 'error'; title: string; message?: string;
  }>({ open: false, type: 'success', title: '' });
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [conversations, scrollToBottom]);

  const fetchCustomers = useCallback(async () => {
    setLoadingCustomers(true);
    try {
      const params: any = { limit: 50 };
      if (search) params.search = search;
      const res = await api.get('/customers', { params });
      setCustomers(res.data.data.data);
    } catch (err) {
      setStatusDialog({ open: true, type: 'error', title: 'Failed to Load', message: getErrorMessage(err) });
    } finally {
      setLoadingCustomers(false);
    }
  }, [search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const selectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setLoadingConversations(true);
    try {
      const res = await api.get(`/customers/${customer.id}/conversations`);
      setConversations(res.data.data.reverse());
    } catch (err) {
      setStatusDialog({ open: true, type: 'error', title: 'Failed to Load Conversations', message: getErrorMessage(err) });
    } finally {
      setLoadingConversations(false);
    }
  };

  const handleTakeover = async () => {
    if (!selectedCustomer || !user) return;
    try {
      const res = await api.put(`/customers/${selectedCustomer.id}/takeover`, { adminId: user.id });
      setSelectedCustomer(res.data.data);
      setStatusDialog({ open: true, type: 'success', title: 'Takeover Activated', message: 'You are now managing this conversation.' });
    } catch (err) {
      setStatusDialog({ open: true, type: 'error', title: 'Takeover Failed', message: getErrorMessage(err) });
    }
  };

  const handleRelease = async () => {
    if (!selectedCustomer) return;
    try {
      const res = await api.put(`/customers/${selectedCustomer.id}/release`);
      setSelectedCustomer(res.data.data);
      setStatusDialog({ open: true, type: 'success', title: 'Takeover Released', message: 'Bot will resume handling the conversation.' });
    } catch (err) {
      setStatusDialog({ open: true, type: 'error', title: 'Release Failed', message: getErrorMessage(err) });
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || !selectedCustomer || !user) return;
    setSending(true);
    try {
      await api.post(`/customers/${selectedCustomer.id}/message`, {
        content: message,
        adminId: user.id,
      });
      setMessage('');
      const res = await api.get(`/customers/${selectedCustomer.id}/conversations`);
      setConversations(res.data.data.reverse());
    } catch (err) {
      setStatusDialog({ open: true, type: 'error', title: 'Send Failed', message: getErrorMessage(err) });
    } finally {
      setSending(false);
    }
  };

  const isTakeoverActive = selectedCustomer?.isAdminTakeover && selectedCustomer?.takeoverAdminId;

  return (
    <div className="flex h-[calc(100vh-6rem)] -m-6 gap-0">
      {/* Customer List */}
      <div className="w-80 bg-white border-r border-gray-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-gray-200">
          <h1 className="text-lg font-bold text-gray-900 mb-3">Messenger</h1>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingCustomers ? (
            <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Loading...
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">No customers found</div>
          ) : (
            customers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => selectCustomer(customer)}
                className={cn(
                  'w-full px-4 py-3 text-left border-b border-gray-100 hover:bg-gray-50 transition-colors',
                  selectedCustomer?.id === customer.id && 'bg-primary-50 border-l-2 border-l-primary-600'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">
                      {customer.fullName || customer.facebookName || 'Unknown'}
                    </div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">{customer.messengerPsid}</div>
                  </div>
                  <span className={cn(
                    'shrink-0 px-1.5 py-0.5 rounded text-xs font-medium',
                    customer.conversationState === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                    customer.conversationState === 'ESCALATED' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-gray-100 text-gray-600'
                  )}>
                    {customer.conversationState}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <MessageSquare className="w-3 h-3 text-gray-400" />
                  <span className="text-xs text-gray-400">{customer._count.conversations} messages</span>
                  {customer.isAdminTakeover && (
                    <span className="text-xs text-purple-600 font-medium">Takeover</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-white">
        {selectedCustomer ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5 text-primary-600" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-gray-900 truncate">
                    {selectedCustomer.fullName || selectedCustomer.facebookName || 'Unknown'}
                  </h2>
                  <p className="text-xs text-gray-500 truncate">{selectedCustomer.messengerPsid}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {selectedCustomer.contactNumber && (
                  <span className="flex items-center gap-1 text-xs text-gray-500" title={selectedCustomer.contactNumber}>
                    <Phone className="w-3.5 h-3.5" />
                  </span>
                )}
                {selectedCustomer.emailAddress && (
                  <span className="flex items-center gap-1 text-xs text-gray-500" title={selectedCustomer.emailAddress}>
                    <Mail className="w-3.5 h-3.5" />
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Globe className="w-3.5 h-3.5" />
                  {selectedCustomer.preferredLang}
                </span>

                {isTakeoverActive ? (
                  <button
                    onClick={handleRelease}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg hover:bg-purple-100"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    Release
                  </button>
                ) : (
                  <button
                    onClick={handleTakeover}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary-700 bg-primary-50 rounded-lg hover:bg-primary-100"
                  >
                    <UserCheck className="w-3.5 h-3.5" />
                    Takeover
                  </button>
                )}
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {loadingConversations ? (
                <div className="flex items-center justify-center py-12 text-gray-500 text-sm">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading messages...
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-12">
                  <Bot className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-sm text-gray-500">No conversations yet</p>
                </div>
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
                      'max-w-[70%] rounded-2xl px-4 py-2.5',
                      conv.direction === 'inbound'
                        ? 'bg-gray-100 text-gray-900 rounded-tl-sm'
                        : conv.isAdminTakeover
                          ? 'bg-purple-100 text-purple-900 rounded-tr-sm'
                          : 'bg-primary-100 text-primary-900 rounded-tr-sm'
                    )}>
                      <div className="text-sm whitespace-pre-wrap break-words">{conv.content}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-gray-500">{formatDate(conv.createdAt)}</span>
                        {conv.isAdminTakeover && (
                          <span className="text-[10px] text-purple-600 font-medium">Admin</span>
                        )}
                        {conv.direction === 'outbound' && !conv.isAdminTakeover && (
                          <span className="text-[10px] text-primary-600 font-medium">Bot</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="px-6 py-4 border-t border-gray-200">
              {isTakeoverActive ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={sending || !message.trim()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-primary-600 text-white rounded-xl hover:bg-primary-700 disabled:opacity-50 text-sm font-medium"
                  >
                    {sending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    Send
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 rounded-xl">
                  <Bot className="w-4 h-4 text-gray-400" />
                  <p className="text-sm text-gray-500">
                    Take over the conversation to send messages
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-gray-200 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-1">Select a conversation</h3>
              <p className="text-sm text-gray-500">Choose a customer from the list to start chatting</p>
            </div>
          </div>
        )}
      </div>

      <StatusDialog
        open={statusDialog.open}
        type={statusDialog.type}
        title={statusDialog.title}
        message={statusDialog.message}
        onClose={() => setStatusDialog({ ...statusDialog, open: false })}
      />
    </div>
  );
}
