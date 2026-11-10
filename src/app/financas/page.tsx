import { FinancesService } from '@/features/finances/service';
import { FinancesDashboardClient } from '@/features/finances/components/FinancesDashboardClient';
import { toRecifeDateString } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default function FinancasPage() {
  const financesService = new FinancesService();
  const transactions = financesService.listTransactions();
  const hideBalance = financesService.getHideBalance();
  const referenceDate = toRecifeDateString();

  return (
    <FinancesDashboardClient
      initialTransactions={transactions}
      initialHideBalance={hideBalance}
      referenceDate={referenceDate}
    />
  );
}
