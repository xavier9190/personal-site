import type { AppDatabase } from '@/db';
import { getDb } from '@/db';
import * as schema from './schema';

export class CalendarService {
  constructor(private readonly db: AppDatabase = getDb()) {}

  listEvents() {
    return this.db.select().from(schema.calendarEvents).all();
  }
}
