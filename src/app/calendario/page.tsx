import { CalendarClient } from '@/features/calendar/components/CalendarClient';
import { CalendarService } from '@/features/calendar/service';
import { fetchRange } from '@/features/calendar/views';
import { toRecifeDateString } from '@/lib/dates';

export const dynamic = 'force-dynamic';

export default function CalendarioPage() {
  const service = new CalendarService();
  const today = toRecifeDateString();
  const range = fetchRange('WEEK', today, today);

  return (
    <CalendarClient
      today={today}
      initialItems={service.listItems(range.from, range.to)}
      events={service.listEvents()}
    />
  );
}
