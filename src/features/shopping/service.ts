import type { AppDatabase } from '@/db';
import { getDb } from '@/db';
import * as schema from './schema';

export class ShoppingService {
  constructor(private readonly db: AppDatabase = getDb()) {}

  listItemsBySection() {
    const all = this.db.select().from(schema.shoppingItems).all();
    return {
      wishlist: all.filter((item) => item.status === 'WISHLIST'),
      inTransit: all.filter((item) => item.status === 'IN_TRANSIT'),
      delivered: all.filter((item) => item.status === 'DELIVERED'),
    };
  }
}
