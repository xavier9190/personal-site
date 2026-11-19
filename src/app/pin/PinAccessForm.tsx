'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Eye, EyeOff, Lock, ShieldAlert } from 'lucide-react';
import { SketchCard } from '@/components/sketch/SketchCard';
import { SketchButton } from '@/components/sketch/SketchButton';
import { ALLOWED_SESSION_DAYS } from '@/lib/pin-auth';
import { cn } from '@/lib/utils';

export interface PinAccessFormProps {
  defaultSessionDays: number;
  maxSessionDays: number;
  isMisconfigured: boolean;
}

export function PinAccessForm({
  defaultSessionDays,
  maxSessionDays,
  isMisconfigured,
}: PinAccessFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialDays = Math.min(defaultSessionDays, maxSessionDays);

  const [pin, setPin] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [sessionDays, setSessionDays] = useState<number>(initialDays);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isMisconfigured) {
      return;
    }
    if (!pin.trim()) {
      setError('INFORME A CREDENCIAL DE ACESSO.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin, sessionDays }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'CREDENCIAL INVÁLIDA.');
        setLoading(false);
        return;
      }

      const nextPath = searchParams.get('next');
      const target =
        nextPath && nextPath.startsWith('/') && !nextPath.startsWith('//') ? nextPath : '/';
      router.push(target);
      router.refresh();
    } catch {
      setError('FALHA AO VALIDAR A CREDENCIAL.');
      setLoading(false);
    }
  }

  return (
    <SketchCard className="w-full max-w-md space-y-5">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-[#f1f3f5]" aria-hidden="true" />
          <h1 className="text-xl tracking-wider uppercase">ACESSO AO HUB PESSOAL</h1>
        </div>
        <p className="text-xs text-[#868e96] uppercase">
          DIGITE SUA CREDENCIAL MESTRE E ESCOLHA POR QUANTOS DIAS MANTER ESTE DISPOSITIVO CONECTADO.
        </p>
      </div>

      {isMisconfigured && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-md border-2 border-dashed border-[#f1f3f5] bg-[#121212] p-3 text-xs text-[#f1f3f5] uppercase"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-bold">CONFIGURAÇÃO PENDENTE EM PRODUÇÃO (FAIL-CLOSED)</p>
            <p className="text-[#868e96]">
              O ACESSO ESTÁ BLOQUEADO ATÉ QUE AS VARIÁVEIS APP_ACCESS_PIN E AUTH_SECRET SEJAM
              DEFINIDAS NO SERVIDOR.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="pin-input" className="mb-1 block text-xs uppercase">
            CREDENCIAL MESTRE (SENHA OU PIN LONGO)
          </label>
          <div className="relative flex items-center">
            <input
              id="pin-input"
              type={showSecret ? 'text' : 'password'}
              autoComplete="current-password"
              disabled={isMisconfigured || loading}
              value={pin}
              onChange={(e) => setPin(e.target.value)}
              placeholder="DIGITE SUA CREDENCIAL"
              className="w-full rounded-md border-2 border-[#f1f3f5] bg-[#121212] py-2 pr-11 pl-3 text-[#f1f3f5] normal-case placeholder:uppercase focus:outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => setShowSecret((prev) => !prev)}
              disabled={isMisconfigured}
              aria-label={showSecret ? 'OCULTAR CREDENCIAL' : 'EXIBIR CREDENCIAL'}
              title={showSecret ? 'OCULTAR CREDENCIAL' : 'EXIBIR CREDENCIAL'}
              className="absolute right-2 flex h-8 w-8 items-center justify-center rounded border border-transparent text-[#f1f3f5] hover:border-[#f1f3f5]/40 disabled:opacity-50"
            >
              {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <fieldset disabled={isMisconfigured || loading} className="space-y-2">
          <legend className="text-xs uppercase">MANTER CONECTADO POR</legend>
          <div className="grid grid-cols-3 gap-2">
            {ALLOWED_SESSION_DAYS.map((days) => {
              const disabledByServerCap = days > maxSessionDays;
              const selected = sessionDays === days;
              return (
                <button
                  key={days}
                  type="button"
                  disabled={disabledByServerCap || isMisconfigured || loading}
                  aria-pressed={selected}
                  onClick={() => setSessionDays(days)}
                  className={cn(
                    'min-h-[40px] rounded-md border-2 bg-[#121212] px-2 py-2 text-xs tracking-wider uppercase transition-all',
                    selected
                      ? 'border-[#f1f3f5] text-[#f1f3f5] underline decoration-2 underline-offset-4'
                      : 'border-[#f1f3f5]/40 text-[#868e96] hover:border-[#f1f3f5]/80 hover:text-[#f1f3f5]',
                    disabledByServerCap && 'cursor-not-allowed opacity-35',
                  )}
                >
                  {selected ? `[${days} DIAS]` : `${days} DIAS`}
                </button>
              );
            })}
          </div>
          {maxSessionDays < 90 && (
            <p className="text-[10px] text-[#868e96] uppercase">
              LIMITE MÁXIMO DO SERVIDOR: {maxSessionDays} DIAS.
            </p>
          )}
        </fieldset>

        {error && (
          <p
            role="alert"
            className="rounded border border-dashed border-[#f1f3f5] bg-[#121212] px-3 py-2 text-xs text-[#f1f3f5] uppercase"
          >
            {error}
          </p>
        )}

        <SketchButton
          type="submit"
          variant="outline"
          disabled={loading || isMisconfigured}
          className="w-full"
        >
          {loading ? 'VALIDANDO...' : 'ENTRAR NO HUB'}
        </SketchButton>
      </form>
    </SketchCard>
  );
}
