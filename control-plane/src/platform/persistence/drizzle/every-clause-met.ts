import { type SQL, type SQLWrapper, sql } from 'drizzle-orm';

export const everyClauseMet = (
  clauses: SQLWrapper,
  terms: readonly string[],
): SQL => sql`NOT EXISTS (
  SELECT 1 FROM jsonb_array_elements(${clauses}) AS clause
  WHERE NOT (clause ?| ARRAY[${sql.join(
    terms.map((each) => sql`${each}`),
    sql`, `,
  )}]::text[])
)`;
