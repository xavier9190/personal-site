import { CalendarClient } from '@/features/calendar/components/CalendarClient';
import { CalendarService } from '@/features/calendar/service';
import { fetchRange } from '@/features/calendar/views';
import { toRecifeDateString } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function CalendarioPage() {
  const service = new CalendarService();
  const today = toRecifeDateString();
  const range = fetchRange('AGENDA', today, today);
  const [initialItems, events] = await Promise.all([
    service.listItems(range.from, range.to),
    service.listEvents(),
  ]);

  return (
    <CalendarClient
      today={today}
      initialItems={initialItems}
      events={events}
    />
  );
}
