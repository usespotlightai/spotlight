import { type SQL, type SQLWrapper, sql } from 'drizzle-orm';

export const inList = (column: SQLWrapper, values: readonly string[]): SQL =>
  sql`${column} in (select jsonb_array_elements_text(${JSON.stringify(values)}::jsonb))`;
