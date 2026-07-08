'use client';

import { useEffect } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useModalAnimation } from '@/hooks/useModalAnimation';
import { useFocusTrap } from '@/hooks/useFocusTrap';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'default';
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', variant = 'default', loading, onConfirm, onCancel }: ConfirmDialogProps) {
  const { visible, closing, close } = useModalAnimation(open, onCancel);
  const trapRef = useFocusTrap(visible);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, close]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={close}>
      <div className={`fixed inset-0 bg-black/50 transition-opacity duration-200 ${closing ? 'opacity-0' : 'opacity-100'}`} />
      <div ref={trapRef} className={`relative bg-card rounded-2xl max-w-sm w-full p-6 shadow-xl transition-all duration-200 ${closing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`} onClick={e => e.stopPropagation()}>
        <div className="flex items-start gap-4">
          {variant === 'danger' && (
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-red-600" />
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-foreground opacity-50 mt-1">{message}</p>
          </div>
        </div>
        <div className="flex gap-2 mt-6">
          <button
            onClick={onCancel}
            disabled={loading}
            className="flex-1 py-2 border border-gray-300 text-foreground rounded-lg hover:bg-card-hover disabled:opacity-50 text-sm font-medium"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={`flex-1 py-2 rounded-lg text-sm font-medium flex items-center justify-center gap-2 disabled:opacity-50 ${
              variant === 'danger'
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
