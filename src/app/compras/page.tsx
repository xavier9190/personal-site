import { ShoppingService } from '@/features/shopping/service';
import { ShoppingDashboardClient } from '@/features/shopping/components/ShoppingDashboardClient';
import { toRecifeDateString } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default function ComprasPage() {
  const service = new ShoppingService();
  const today = toRecifeDateString();
  const { wishlist, delivered } = service.listItemsBySection();

  return (
    <ShoppingDashboardClient
      wishlist={wishlist}
      inTransit={service.listInTransitView(today)}
      delivered={delivered}
      today={today}
    />
  );
}
