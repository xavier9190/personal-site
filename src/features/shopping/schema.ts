import { integer, pgTable, text } from 'drizzle-orm/pg-core';

export const shoppingItems = pgTable('shopping_items', {
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
