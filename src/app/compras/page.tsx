import { ShoppingService } from '@/features/shopping/service';
import { ShoppingDashboardClient } from '@/features/shopping/components/ShoppingDashboardClient';
import { toRecifeDateString } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function ComprasPage() {
  const service = new ShoppingService();
  const today = toRecifeDateString();
  const [{ wishlist, delivered }, inTransit] = await Promise.all([
    service.listItemsBySection(),
    service.listInTransitView(today),
  ]);

  return (
    <ShoppingDashboardClient
      wishlist={wishlist}
      inTransit={inTransit}
      delivered={delivered}
      today={today}
    />
  );
}
