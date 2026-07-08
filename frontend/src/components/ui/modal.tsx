'use client';

import { ReactNode } from 'react';
import { useModalAnimation } from '@/hooks/useModalAnimation';
import { useFocusTrap } from '@/hooks/useFocusTrap';
import { X } from 'lucide-react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showClose?: boolean;
}

const sizes = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
  full: 'max-w-4xl',
};

export function Modal({ open, onClose, children, title, size = 'md', showClose = true }: ModalProps) {
  const { visible, closing, close } = useModalAnimation(open, onClose);
  const trapRef = useFocusTrap(visible);

  if (!visible) return null;

  return (
    <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 transition-opacity duration-200 ${closing ? 'opacity-0' : 'opacity-100'}`} onClick={close}>
      <div className="fixed inset-0 bg-black/50" />
      <div
        ref={trapRef}
        className={`relative bg-card rounded-2xl w-full ${sizes[size]} max-h-[90vh] overflow-y-auto shadow-xl transition-all duration-200 ${closing ? 'opacity-0 scale-95' : 'opacity-100 scale-100'}`}
        onClick={e => e.stopPropagation()}
      >
        {title && (
          <div className="flex items-center justify-between p-6 border-b border-card sticky top-0 bg-card z-10 rounded-t-2xl">
            <h2 className="text-xl font-bold">{title}</h2>
            {showClose && (
              <button onClick={close} className="p-2 hover:bg-card-hover rounded-lg" aria-label="Close modal">
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
