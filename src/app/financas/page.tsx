import { FinancesService } from '@/features/finances/service';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/sketch/EmptyState';
import { SketchCard } from '@/components/sketch/SketchCard';
import { formatCentsToBRL } from '@/lib/currency';

export const dynamic = 'force-dynamic';

export default function FinancasPage() {
  const financesService = new FinancesService();
  const transactions = financesService.listTransactions();
  const installments = financesService.listInstallmentPlans();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        moduleId="finances"
        subtitle="SALDO, CONTAS A PAGAR, TRANSAÇÕES E PARCELAS EM CENTAVOS"
      />

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <SketchCard className="space-y-1">
          <span className="text-xs text-[#868e96]">SALDO</span>
          <p className="text-2xl text-[#f1f3f5]">{formatCentsToBRL(0)}</p>
        </SketchCard>

        <SketchCard className="space-y-1">
          <span className="text-xs text-[#868e96]">A PAGAR</span>
          <p className="text-2xl text-[#f1f3f5]">{formatCentsToBRL(0)}</p>
          <span className="text-[11px] text-[#868e96]">FALTAM 0 CONTAS</span>
        </SketchCard>

        <SketchCard className="space-y-1">
          <span className="text-xs text-[#868e96]">PREVISTO</span>
          <p className="text-2xl text-[#f1f3f5]">{formatCentsToBRL(0)}</p>
        </SketchCard>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2">
          <h2 className="text-base tracking-wider">ÚLTIMAS TRANSAÇÕES</h2>
          {transactions.length === 0 ? (
            <EmptyState
              title="NENHUMA TRANSAÇÃO REGISTRADA"
              description="ADICIONE SUA PRIMEIRA ENTRADA OU SAÍDA PARA INICIAR SEU FLUXO DE CAIXA."
              actionLabel="+ ADICIONAR"
            />
          ) : null}
        </section>

        <aside className="space-y-3">
          <h2 className="text-base tracking-wider">PARCELAS A PAGAR</h2>
          {installments.length === 0 ? (
            <EmptyState
              title="SEM PARCELAMENTOS ATIVOS"
              description="SUAS COMPRAS PARCELADAS APARECERÃO AQUI NO FORMATO N/TOTAL."
            />
          ) : null}
        </aside>
      </div>
    </div>
  );
}
