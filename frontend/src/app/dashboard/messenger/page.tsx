'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/store';
import { formatDate, cn } from '@/lib/utils';
import { getErrorMessage } from '@/lib/error-utils';
import { useDebounce } from '@/hooks/useDebounce';
import { toast } from 'sonner';
import { Search, Send, MessageSquare, Phone, Mail, Globe, Bot, UserCheck, UserX, Loader2, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

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
  const debouncedSearch = useDebounce(search, 300);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [conversations, scrollToBottom]);

  const fetchCustomers = useCallback(async (showLoader = true) => {
    if (showLoader) setLoadingCustomers(true);
    try {
      const params: any = { limit: 20, page };
      if (debouncedSearch) params.search = debouncedSearch;
      const res = await api.get('/customers', { params });
      setCustomers(res.data.data.data);
      setTotal(res.data.data.total);
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingCustomers(false);
      setSearching(false);
    }
  }, [debouncedSearch, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  useEffect(() => {
    setSearching(true);
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    if (!selectedCustomer) return;
    const interval = setInterval(async () => {
      try {
        const [custRes, convRes] = await Promise.all([
          api.get(`/customers/${selectedCustomer.id}`),
          api.get(`/customers/${selectedCustomer.id}/conversations`),
        ]);
        setSelectedCustomer(custRes.data.data);
        setConversations(convRes.data.data.reverse());
      } catch { /* silent */ }
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedCustomer?.id]);

  const selectCustomer = async (customer: Customer) => {
    setSelectedCustomer(customer);
    setLoadingConversations(true);
    try {
      const res = await api.get(`/customers/${customer.id}/conversations`);
      setConversations(res.data.data.reverse());
    } catch (err) {
      toast.error(getErrorMessage(err));
    } finally {
      setLoadingConversations(false);
    }
  };

  const handleTakeover = async () => {
    if (!selectedCustomer || !user) return;
    try {
      const res = await api.put(`/customers/${selectedCustomer.id}/takeover`, { adminId: user.id });
      setSelectedCustomer(res.data.data);
      toast.success('You are now managing this conversation.');
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleRelease = async () => {
    if (!selectedCustomer) return;
    try {
      const res = await api.put(`/customers/${selectedCustomer.id}/release`);
      setSelectedCustomer(res.data.data);
      toast.success('Bot will resume handling the conversation.');
    } catch (err) {
      toast.error(getErrorMessage(err));
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
      toast.error(getErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const isTakeoverActive = selectedCustomer?.isAdminTakeover && selectedCustomer?.takeoverAdminId;

  return (
    <div className="flex h-[calc(100vh-6rem)] -m-6 gap-0">
      {/* Customer List */}
      <div className="w-80 bg-card border-r border-card-border flex flex-col shrink-0">
        <div className="p-4 border-b border-card-border">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-foreground">Messenger</h1>
            <button onClick={() => fetchCustomers()} className="p-1.5 text-foreground opacity-40 hover:text-primary-600 hover:bg-primary-50 rounded" title="Refresh" aria-label="Refresh customers">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground opacity-40" />
            <input
              type="text"
              placeholder="Search customers..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-foreground opacity-40 animate-spin" />
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingCustomers ? (
            <div className="flex items-center justify-center py-12 text-foreground opacity-50 text-sm">
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Loading...
            </div>
          ) : customers.length === 0 ? (
            <div className="text-center py-12 text-foreground opacity-50">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 text-foreground opacity-30 animate-float" />
              <p className="text-sm">No customers found</p>
            </div>
          ) : (
            customers.map((customer) => (
              <button
                key={customer.id}
                onClick={() => selectCustomer(customer)}
                className={cn(
                  'w-full px-4 py-3 text-left border-b border-card-border hover:bg-card-hover transition-colors',
                  selectedCustomer?.id === customer.id && 'bg-primary-50 border-l-2 border-l-primary-600'
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">
                      {customer.fullName || customer.facebookName || 'Unknown'}
                    </div>
                    <div className="text-xs text-foreground opacity-50 truncate mt-0.5">{customer.messengerPsid}</div>
                  </div>
                  <span className={cn(
                    'shrink-0 px-1.5 py-0.5 rounded text-xs font-medium',
                    customer.conversationState === 'ACTIVE' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' :
                    customer.conversationState === 'ESCALATED' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300' :
                    'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                  )}>
                    {customer.conversationState}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <MessageSquare className="w-3 h-3 text-foreground opacity-40" />
                  <span className="text-xs text-foreground opacity-40">{customer._count.conversations} messages</span>
                  {customer.isAdminTakeover && (
                    <span className="text-xs text-purple-600 font-medium">Takeover</span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
        {total > 20 && (
          <div className="flex items-center justify-between px-4 py-2 border-t border-card-border">
            <span className="text-xs text-foreground opacity-50">Page {page} of {Math.ceil(total / 20)}</span>
            <div className="flex gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="p-1 text-foreground opacity-40 hover:text-primary-600 disabled:opacity-20 rounded"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= Math.ceil(total / 20)}
                className="p-1 text-foreground opacity-40 hover:text-primary-600 disabled:opacity-20 rounded"
                aria-label="Next page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col bg-card">
        {selectedCustomer ? (
          <>
            {/* Chat Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-card-border">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                  <MessageSquare className="w-5 h-5 text-primary-600" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm font-bold text-foreground truncate">
                    {selectedCustomer.fullName || selectedCustomer.facebookName || 'Unknown'}
                  </h2>
                  <p className="text-xs text-foreground opacity-50 truncate">{selectedCustomer.messengerPsid}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {selectedCustomer.contactNumber && (
                  <span className="flex items-center gap-1 text-xs text-foreground opacity-50" title={selectedCustomer.contactNumber}>
                    <Phone className="w-3.5 h-3.5" />
                  </span>
                )}
                {selectedCustomer.emailAddress && (
                  <span className="flex items-center gap-1 text-xs text-foreground opacity-50" title={selectedCustomer.emailAddress}>
                    <Mail className="w-3.5 h-3.5" />
                  </span>
                )}
                <span className="flex items-center gap-1 text-xs text-foreground opacity-50">
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
                <div className="flex items-center justify-center py-12 text-foreground opacity-50 text-sm">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Loading messages...
                </div>
              ) : conversations.length === 0 ? (
                <div className="text-center py-12">
                  <Bot className="w-12 h-12 text-foreground opacity-30 mx-auto mb-3 animate-float" />
                  <p className="text-sm text-foreground opacity-50">No conversations yet</p>
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
                        ? 'bg-gray-100 dark:bg-gray-700 text-foreground rounded-tl-sm'
                        : conv.isAdminTakeover
                          ? 'bg-purple-100 text-purple-900 rounded-tr-sm'
                          : 'bg-primary-100 text-primary-900 rounded-tr-sm'
                    )}>
                      <div className="text-sm whitespace-pre-wrap break-words">{conv.content}</div>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="text-[10px] text-foreground opacity-50">{formatDate(conv.createdAt)}</span>
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
            <div className="px-6 py-4 border-t border-card-border">
              {isTakeoverActive ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                    placeholder="Type a message..."
                    className="flex-1 px-4 py-2.5 text-sm border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                  <Bot className="w-4 h-4 text-foreground opacity-40" />
                  <p className="text-sm text-foreground opacity-50">
                    Take over the conversation to send messages
                  </p>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageSquare className="w-16 h-16 text-foreground opacity-20 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-1">Select a conversation</h3>
              <p className="text-sm text-foreground opacity-50">Choose a customer from the list to start chatting</p>
            </div>
          </div>
        )}
      </div>

    </div>
  );
}
