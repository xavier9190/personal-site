import {
  FinancesService,
  type FinancePeriod,
} from '@/features/finances/service';
import { FinancesDashboardClient } from '@/features/finances/components/FinancesDashboardClient';

export const dynamic = 'force-dynamic';

const VALID_PERIODS: readonly FinancePeriod[] = [
  'THIS_MONTH',
  'LAST_MONTH',
  'NEXT_MONTH',
  'ALL',
];

export default async function FinancasPage(props: {
  searchParams?: Promise<{
    period?: string;
    date?: string;
    category?: string;
  }>;
}) {
  const resolvedParams = (await props.searchParams) ?? {};
  const period: FinancePeriod = VALID_PERIODS.includes(
    resolvedParams.period as FinancePeriod,
  )
    ? (resolvedParams.period as FinancePeriod)
    : 'THIS_MONTH';

  const financesService = new FinancesService();
  const view = financesService.getDashboardView({
    period,
    date: resolvedParams.date,
    category: resolvedParams.category,
  });

  return <FinancesDashboardClient view={view} />;
}
