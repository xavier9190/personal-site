import { CalendarClient } from '@/features/calendar/components/CalendarClient';
import { CalendarService } from '@/features/calendar/service';
import { fetchRange } from '@/features/calendar/views';
import { toRecifeDateString } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default async function CalendarioPage() {
  const service = new CalendarService();
  const today = toRecifeDateString();
  const range = fetchRange('AGENDA', today, today);
  const { items: initialItems, events } = await service.listItemsAndEvents(range.from, range.to);

  return (
    <CalendarClient
      today={today}
      initialItems={initialItems}
      events={events}
    />
  );
}
