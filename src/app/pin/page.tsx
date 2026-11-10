'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { SketchCard } from '@/components/sketch/SketchCard';
import { SketchButton } from '@/components/sketch/SketchButton';

export default function PinAccessPage() {
  const router = useRouter();
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

      router.push('/');
      router.refresh();
    } catch {
      setError('FALHA AO VALIDAR O PIN.');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
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
              className="w-full rounded-md border-2 border-[#f1f3f5] bg-[#121212] px-3 py-2 text-[#f1f3f5] focus:border-[#a5d8ff] focus:outline-none"
            />
            {error && (
              <p className="mt-2 rounded border border-[#ffc9c9] bg-[#121212] px-2 py-1 text-xs text-[#ffc9c9] uppercase">
                {error}
              </p>
            )}
          </div>

          <SketchButton
            type="submit"
            variant="filled"
            accentColor="green"
            disabled={loading}
            className="w-full"
          >
            {loading ? 'VALIDANDO...' : 'ENTRAR NO HUB'}
          </SketchButton>
        </form>
      </SketchCard>
    </div>
  );
}
