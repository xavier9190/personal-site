'use client';

import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SketchModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export function SketchModal({
  isOpen,
  onClose,
  title,
  children,
  className,
}: SketchModalProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/75 p-0 md:items-center md:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={cn(
          'max-h-[90vh] w-full overflow-y-auto rounded-t-xl border-2 border-[#f1f3f5] bg-[#1e1e1e] p-5 text-[#f1f3f5] sketch-shadow md:max-w-lg md:rounded-md',
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between border-b-2 border-[#f1f3f5] pb-3">
          <h2 className="text-lg tracking-wider uppercase">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="FECHAR MODAL"
            className="flex h-10 w-10 items-center justify-center rounded-md border-2 border-[#f1f3f5] bg-[#121212] text-[#f1f3f5] hover:bg-[#ffc9c9] hover:text-[#121212]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
