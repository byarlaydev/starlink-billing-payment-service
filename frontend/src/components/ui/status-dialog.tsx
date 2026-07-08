'use client';

import { useEffect } from 'react';
import { CheckCircle2, XCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusDialogProps {
  open: boolean;
  type: 'success' | 'error';
  title: string;
  message?: string;
  onClose: () => void;
}

export function StatusDialog({ open, type, title, message, onClose }: StatusDialogProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center animate-in fade-in zoom-in-95 duration-200">
        <div className="mb-4">
          {type === 'success' ? (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
          ) : (
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100">
              <XCircle className="w-10 h-10 text-red-600" />
            </div>
          )}
        </div>

        <div className="flex items-center justify-between mb-2">
          <div className="flex-1" />
          <h3 className={cn(
            'text-lg font-bold',
            type === 'success' ? 'text-green-800' : 'text-red-800'
          )}>
            {title}
          </h3>
          <div className="flex-1 flex justify-end">
            <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {message && (
          <p className="text-sm text-gray-600 mt-1 mb-6">{message}</p>
        )}

        <button
          onClick={onClose}
          className={cn(
            'w-full py-2.5 rounded-lg text-white font-medium text-sm',
            type === 'success'
              ? 'bg-green-600 hover:bg-green-700'
              : 'bg-red-600 hover:bg-red-700'
          )}
        >
          {type === 'success' ? 'Done' : 'Close'}
        </button>
      </div>
    </div>
  );
}
