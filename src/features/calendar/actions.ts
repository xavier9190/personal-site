'use server';

import { revalidatePath } from 'next/cache';
import { CalendarService, type CalendarItem, type EventInput } from './service';

export interface CalendarActionResult<T = unknown> {
  ok: boolean;
  data?: T;
  error?: string;
}

function run<T>(fn: (service: CalendarService) => T, fallback: string): CalendarActionResult<T> {
  try {
    const data = fn(new CalendarService());
    revalidatePath('/calendario');
    revalidatePath('/');
    return { ok: true, data };
  } catch (err) {
    let error = fallback;
    if (err instanceof Error) {
      const issues = (err as { issues?: Array<{ message: string }> }).issues;
      error = issues?.length ? issues.map((i) => i.message).join('; ') : err.message;
    }
    return { ok: false, error };
  }
}

export async function listCalendarItemsAction(from: string, to: string): Promise<CalendarItem[]> {
  return new CalendarService().listItems(from, to);
}

export async function createEventAction(input: EventInput) {
  return run((s) => s.createEvent(input), 'ERRO AO CRIAR EVENTO');
}

export async function updateEventAction(id: string, input: EventInput) {
  return run((s) => s.updateEvent(id, input), 'ERRO AO EDITAR EVENTO');
}

export async function deleteEventAction(id: string) {
  return run((s) => s.deleteEvent(id), 'ERRO AO EXCLUIR EVENTO');
}
