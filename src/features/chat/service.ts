import type { AppDatabase } from '@/db';
import { getDb } from '@/db';
import * as schema from './schema';

export class ChatService {
  constructor(private readonly db: AppDatabase = getDb()) {}

  listMessages() {
    return this.db.select().from(schema.chatMessages).all();
  }
}
