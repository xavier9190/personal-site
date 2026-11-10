import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const shoppingItems = sqliteTable('shopping_items', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  priceCents: integer('price_cents').notNull(),
  productUrl: text('product_url'),
  status: text('status', {
    enum: ['WISHLIST', 'IN_TRANSIT', 'DELIVERED'],
  }).notNull(),
  storeApp: text('store_app'),
  trackingUrl: text('tracking_url'),
  purchasedAt: text('purchased_at'),
  estimatedDeliveryDate: text('estimated_delivery_date'),
  deliveredAt: text('delivered_at'),
});
