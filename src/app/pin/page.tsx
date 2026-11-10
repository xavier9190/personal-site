'use client';

import { Suspense, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { SketchCard } from '@/components/sketch/SketchCard';
import { SketchButton } from '@/components/sketch/SketchButton';

function PinAccessForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pin.trim()) {
      setError('INFORME O PIN DE ACESSO LOCAL.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin }),
      });

      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !data.ok) {
        setError(data.error ?? 'PIN INVÁLIDO.');
        setLoading(false);
        return;
      }

      const nextPath = searchParams.get('next');
      const target = nextPath && nextPath.startsWith('/') ? nextPath : '/';
      router.push(target);
      router.refresh();
    } catch {
      setError('FALHA AO VALIDAR O PIN.');
      setLoading(false);
    }
  }

  return (
    <SketchCard className="w-full max-w-md space-y-4">
      <h1 className="text-xl tracking-wider uppercase">ACESSO REDE LOCAL (PIN)</h1>
      <p className="text-xs text-[#868e96] uppercase">
        DIGITE O PIN CONFIGURADO EM APP_ACCESS_PIN PARA LIBERAR O HUB PESSOAL.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="pin-input" className="mb-1 block text-xs uppercase">
            PIN DE ACESSO
          </label>
          <input
            id="pin-input"
            type="password"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="••••"
            className="w-full rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-2 text-[#f1f3f5] focus:outline-none"
          />
          {error && (
            <p className="mt-2 rounded border border-dashed border-[#f1f3f5] bg-[#121212] px-2 py-1 text-xs text-[#f1f3f5] uppercase">
              {error}
            </p>
          )}
        </div>

        <SketchButton
          type="submit"
          variant="filled"
          disabled={loading}
          className="w-full"
        >
          {loading ? 'VALIDANDO...' : 'ENTRAR NO HUB'}
        </SketchButton>
      </form>
    </SketchCard>
  );
}

export default function PinAccessPage() {
  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <Suspense fallback={null}>
        <PinAccessForm />
      </Suspense>
    </div>
  );
}
