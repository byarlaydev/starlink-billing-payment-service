'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

export function useModalAnimation(open: boolean, onClose: () => void, duration = 200) {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setClosing(false);
      closingRef.current = false;
    }
  }, [open]);

  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    setTimeout(() => {
      setVisible(false);
      setClosing(false);
      closingRef.current = false;
      onClose();
    }, duration);
  }, [onClose, duration]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, close]);

  return { visible, closing, close };
}
