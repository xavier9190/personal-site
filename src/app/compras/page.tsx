import { ShoppingService } from '@/features/shopping/service';
import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/sketch/EmptyState';

export const dynamic = 'force-dynamic';

export default function ComprasPage() {
  const shoppingService = new ShoppingService();
  const { wishlist, inTransit } = shoppingService.listItemsBySection();

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <PageHeader
        moduleId="shopping"
        subtitle="QUERO COMPRAR (WISHLIST) E JÁ COMPREI (A CAMINHO)"
      />

      <section className="flex flex-1 flex-col space-y-3">
        <h2 className="text-base tracking-wider">QUERO COMPRAR (WISHLIST)</h2>
        {wishlist.length === 0 ? (
          <EmptyState
            title="SUA WISHLIST ESTÁ VAZIA"
            description="ADICIONE PRODUTOS QUE DESEJA COMPRAR COM PREÇO ESTIMADO E LINK DIRETO."
            actionLabel="+ ADICIONAR"
          />
        ) : null}
      </section>

      <section className="flex flex-1 flex-col space-y-3 border-t-2 border-[#f1f3f5] pt-4">
        <h2 className="text-base tracking-wider">JÁ COMPREI (A CAMINHO)</h2>
        {inTransit.length === 0 ? (
          <EmptyState
            title="NENHUMA ENCOMENDA EM TRÂNSITO"
            description="QUANDO MARCAR UM ITEM COMO COMPREI ✓, ACOMPANHE O PRAZO E PROGRESSO DE ENTREGA AQUI."
          />
        ) : null}
      </section>
    </div>
  );
}
