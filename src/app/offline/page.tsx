'use client';

import { RefreshCw, WifiOff } from 'lucide-react';
import { SketchCard } from '@/components/sketch/SketchCard';
import { SketchButton } from '@/components/sketch/SketchButton';

export default function OfflinePage() {
  function handleReconnect() {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#121212] p-4 text-[#f1f3f5] uppercase">
      <SketchCard className="w-full max-w-md space-y-5 bg-[#121212] text-[#f1f3f5]">
        <div className="flex items-center gap-3">
          <WifiOff className="h-6 w-6 shrink-0 text-[#f1f3f5]" aria-hidden="true" />
          <h1 className="text-xl tracking-wider text-[#f1f3f5] uppercase">
            MODO OFFLINE
          </h1>
        </div>

        <p className="text-xs leading-relaxed text-[#868e96] uppercase">
          VOCÊ ESTÁ SEM CONEXÃO COM A INTERNET NO MOMENTO. POR SEGURANÇA, SEUS
          DADOS PRIVADOS NÃO FICAM ARMAZENADOS NO CACHE LOCAL.
        </p>

        <div className="border-t border-[#f1f3f5]/30 pt-4">
          <SketchButton
            type="button"
            onClick={handleReconnect}
            className="w-full justify-center bg-[#121212] text-[#f1f3f5]"
          >
            <RefreshCw className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>RECONECTAR</span>
          </SketchButton>
        </div>
      </SketchCard>
    </div>
  );
}
