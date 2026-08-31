import { pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/** What a host has already told us. */
export const handledDelivery = pgTable('handled_delivery', {
  id: text('id').primaryKey(),
  handledAt: timestamp('handled_at').defaultNow().notNull(),
});
