import { ShoppingService } from '@/features/shopping/service';
import { ShoppingDashboardClient } from '@/features/shopping/components/ShoppingDashboardClient';
import { toRecifeDateString } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function ComprasPage() {
  const service = new ShoppingService();
  const today = toRecifeDateString();
  const { wishlist, inTransit, delivered } = await service.getDashboardView(today);

  return (
    <ShoppingDashboardClient
      wishlist={wishlist}
      inTransit={inTransit}
      delivered={delivered}
      today={today}
    />
  );
}
