'use client';

import { useEffect, useRef, useState } from 'react';
import { Download } from 'lucide-react';
import {
  createInstallPromptController,
  type InstallPromptController,
} from '@/lib/pwa-client';
import { cn } from '@/lib/utils';

export interface InstallPwaButtonProps {
  variant: 'desktop' | 'mobile';
}

export function InstallPwaButton({ variant }: InstallPwaButtonProps) {
  const controllerRef = useRef<InstallPromptController | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    const controller = createInstallPromptController(window, (available) => {
      setCanInstall(available);
    });
    controllerRef.current = controller;

    return () => {
      controller.dispose();
      controllerRef.current = null;
    };
  }, []);

  if (!canInstall) {
    return null;
  }

  async function handleInstall() {
    if (installing || !controllerRef.current) return;
    setInstalling(true);
    try {
      await controllerRef.current.triggerInstall();
    } finally {
      setInstalling(false);
    }
  }

  if (variant === 'mobile') {
    return (
      <button
        type="button"
        onClick={handleInstall}
        disabled={installing}
        aria-label="INSTALAR APP (PWA)"
        title="INSTALAR APP (PWA)"
        className={cn(
          'relative flex min-h-[44px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-md border border-transparent bg-[#121212] px-1 py-1 text-[9px] leading-tight tracking-wider text-[#f1f3f5] uppercase transition-all hover:border-[#f1f3f5]/40 disabled:opacity-50',
        )}
      >
        <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span className="truncate">INSTALAR APP (PWA)</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleInstall}
      disabled={installing}
      aria-label="INSTALAR APP (PWA)"
      className="flex min-h-[42px] w-full items-center justify-center gap-2 rounded-md border border-dashed border-[#f1f3f5] bg-[#121212] px-3 py-2 text-xs tracking-wider text-[#f1f3f5] uppercase transition-all hover:border-solid disabled:opacity-50"
    >
      <Download className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{installing ? 'INSTALANDO...' : 'INSTALAR APP (PWA)'}</span>
    </button>
  );
}
