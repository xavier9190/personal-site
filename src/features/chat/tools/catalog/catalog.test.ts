import { describe, expect, it } from 'vitest';
import { createPgliteTestDb } from '@/db/pglite-test';
import { CalendarService } from '@/features/calendar/service';
import { toRecifeDateString } from '@/lib/dates';
import { ChatService } from '../../service';
import { executeChatTool } from '../dispatcher';
import {
  ACTION_CATALOG,
  getActionCatalogEntry,
  getGeminiFunctionDeclarations,
  TOOL_DEFINITIONS,
} from './index';

describe('Action Catalog & Canonical Evento de Agenda Binding', () => {
  it('registers all four modules with rich metadata and keeps TOOL_DEFINITIONS in sync', () => {
    const modules = new Set(Object.values(ACTION_CATALOG).map((e) => e.module));
    expect(modules).toEqual(new Set(['CALENDAR', 'FINANCES', 'ACADEMIC', 'SHOPPING']));

    expect(Object.keys(TOOL_DEFINITIONS)).toEqual(Object.keys(ACTION_CATALOG));

    const createEvent = getActionCatalogEntry('createCalendarEvent');
    expect(createEvent).toBeDefined();
    expect(createEvent?.displayName).toBe('CRIAR EVENTO DE AGENDA');
    expect(createEvent?.entityLabel).toBe('Evento de Agenda');
    expect(createEvent?.operation).toBe('create');
    expect(createEvent?.isDestructive).toBe(false);
    expect(createEvent?.requiredFields).toContain('title');
    expect(createEvent?.fields.date?.inferableDefault).toBeDefined();
    expect(createEvent?.fields.color?.inferableDefault).toBeDefined();
    expect(createEvent?.fields.endTime?.inferableDefault).toBeDefined();

    const deleteEvent = getActionCatalogEntry('deleteCalendarEvent');
    expect(deleteEvent?.operation).toBe('delete');
    expect(deleteEvent?.isDestructive).toBe(true);

    const listCalendar = getActionCatalogEntry('listCalendarItems');
    expect(listCalendar?.operation).toBe('read');
    expect(listCalendar?.isDestructive).toBe(false);
  });

  it('generates Gemini FunctionDeclarations via Zod v4 toJSONSchema without $schema and without required on mutating tools', () => {
    const declarations = getGeminiFunctionDeclarations();
    expect(declarations.length).toBe(Object.keys(ACTION_CATALOG).length);

    const createDecl = declarations.find((d) => d.name === 'createCalendarEvent');
    expect(createDecl).toBeDefined();
    expect(createDecl?.description).toBeTruthy();

    const params = createDecl?.parametersJsonSchema as Record<string, unknown>;
    expect(params).toBeDefined();
    expect(params.$schema).toBeUndefined();
    expect(params.required).toBeUndefined();
    expect(params.type).toBe('object');

    const props = params.properties as Record<string, Record<string, unknown>>;
    expect(Object.keys(props)).toEqual(
      expect.arrayContaining([
        'title',
        'description',
        'date',
        'startTime',
        'endTime',
        'allDay',
        'color',
        'recurrence',
        'recurrenceUntil',
      ]),
    );
    expect(props.color?.enum).toEqual(['green', 'red', 'blue', 'yellow']);

    const updateDecl = declarations.find((d) => d.name === 'updateCalendarEvent');
    expect((updateDecl?.parametersJsonSchema as Record<string, unknown>)?.required).toBeUndefined();

    const deleteDecl = declarations.find((d) => d.name === 'deleteCalendarEvent');
    expect((deleteDecl?.parametersJsonSchema as Record<string, unknown>)?.required).toContain('id');
  });

  it('binds createCalendarEvent directly to eventInputSchema with inferable defaults in Recife', async () => {
    const { db, close } = await createPgliteTestDb();
    try {
      const chat = new ChatService(db);
      const calendar = new CalendarService(db);
      const thread = await chat.createThread('CATALOG TEST');

      // 1. Omitted date, color, and endTime should be inferred cleanly
      const result = await executeChatTool(
        'createCalendarEvent',
        {
          title: 'DENTISTA',
          startTime: '15:00',
        },
        { threadId: thread.id, db, currentDateRecife: '2026-11-20' },
      );

      expect(result.status).toBe('CONFIRMED');
      const events = await calendar.listEvents();
      expect(events).toHaveLength(1);
      expect(events[0].title).toBe('DENTISTA');
      expect(events[0].startAt).toBe('2026-11-20T15:00');
      expect(events[0].endAt).toBe('2026-11-20T16:00');
      expect(events[0].color).toBe('green');

      // 2. Uses today in Recife if currentDateRecife is not supplied
      const resToday = await executeChatTool(
        'createCalendarEvent',
        {
          title: 'ACADEMIA',
          startTime: '23:30',
        },
        { threadId: thread.id, db },
      );
      expect(resToday.status).toBe('CONFIRMED');
      const allEvents = await calendar.listEvents();
      const gym = allEvents.find((e) => e.title === 'ACADEMIA');
      expect(gym?.startAt).toBe(`${toRecifeDateString()}T23:30`);
      expect(gym?.endAt).toBe(`${toRecifeDateString()}T23:59`);

      // 3. Rejects nonexistent calendar date (assertPureDate from eventInputSchema)
      await expect(
        executeChatTool(
          'createCalendarEvent',
          {
            title: 'DATA IMPOSSÍVEL',
            date: '2026-02-30',
            startTime: '10:00',
            endTime: '11:00',
          },
          { threadId: thread.id, db },
        ),
      ).rejects.toThrow();

      // 4. Rejects endTime <= startTime (superRefine from eventInputSchema)
      await expect(
        executeChatTool(
          'createCalendarEvent',
          {
            title: 'HORÁRIO INVÁLIDO',
            date: '2026-11-20',
            startTime: '15:00',
            endTime: '14:00',
          },
          { threadId: thread.id, db },
        ),
      ).rejects.toThrow();

      // 5. Rejects missing title
      await expect(
        executeChatTool(
          'createCalendarEvent',
          {
            date: '2026-11-20',
            startTime: '15:00',
          },
          { threadId: thread.id, db },
        ),
      ).rejects.toThrow();

      // 6. Partial reschedule via updateCalendarEvent preserves original duration and validates via eventInputSchema
      const created = events[0];
      const updatedRes = await executeChatTool(
        'updateCalendarEvent',
        {
          id: created.id,
          startTime: '17:00',
        },
        { threadId: thread.id, db },
      );
      expect(updatedRes.status).toBe('CONFIRMED');
      const reloaded = await calendar.getEvent(created.id);
      expect(reloaded.startAt).toBe('2026-11-20T17:00');
      expect(reloaded.endAt).toBe('2026-11-20T18:00');

      await expect(
        executeChatTool(
          'updateCalendarEvent',
          {
            id: created.id,
            startTime: '17:00',
            endTime: '16:00',
          },
          { threadId: thread.id, db },
        ),
      ).rejects.toThrow();
    } finally {
      await close();
    }
  });
});
