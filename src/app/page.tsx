import { ChatService } from '@/features/chat/service';
import { CalendarService } from '@/features/calendar/service';
import { FinancesService } from '@/features/finances/service';
import { toRecifeDateString } from '@/lib/dates';
import { ChatConversation } from '@/features/chat/components/ChatConversation';
import { ChatRightPanel } from '@/features/chat/components/ChatRightPanel';

export const dynamic = 'force-dynamic';

export default function ChatPage() {
  const chatService = new ChatService();
  const calendarService = new CalendarService();
  const financesService = new FinancesService();

  const defaultThread = chatService.getOrCreateDefaultThread();
  const messages = chatService.listMessages(defaultThread.id);

  const todayRecife = toRecifeDateString();
  const future30DaysDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const futureRecife = toRecifeDateString(future30DaysDate);

  const upcomingItems = calendarService.listItems(todayRecife, futureRecife);

  const summary = financesService.getBalanceSummary();
  const allBills = financesService.listPayableBills();
  const pendingBills = allBills.filter((b) => b.status === 'PENDING');
  const paidBills = allBills.filter((b) => b.status === 'PAID');
  const hideBalance = financesService.getHideBalance();

  return (
    <div className="flex h-[calc(100vh-4rem)] md:h-full w-full min-h-0 flex-1 flex-col lg:flex-row overflow-hidden">
      {/* Central Chat: Message bubbles, streaming, Enter to send, autoscroll */}
      <ChatConversation
        initialThreadId={defaultThread.id}
        initialMessages={messages}
      />

      {/* Right Panel: Strictly desktop only (lg:flex, hidden on mobile) */}
      <ChatRightPanel
        upcomingItems={upcomingItems}
        balanceCents={summary.balanceCents}
        initialHideBalance={hideBalance}
        pendingBills={pendingBills}
        paidBills={paidBills}
        todayRecife={todayRecife}
      />
    </div>
  );
}
