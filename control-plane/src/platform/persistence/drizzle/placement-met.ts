import type { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { type SQL, type SQLWrapper, sql } from 'drizzle-orm';

const everyClauseMet = (
  clauses: SQLWrapper,
  terms: readonly string[],
): SQL => sql`NOT EXISTS (
  SELECT 1 FROM jsonb_array_elements(${clauses}) AS clause
  WHERE NOT (clause ?| ARRAY[${sql.join(
    terms.map((each) => sql`${each}`),
    sql`, `,
  )}]::text[])
)`;

const imageServed = (image: SQLWrapper, terms: RunnerTerms): SQL => {
  const running = terms.running;

  if (!running) {
    return sql`TRUE`;
  }

  return running.isDefault
    ? sql`(${image} IS NULL OR ${image} = ${running.image.value})`
    : sql`${image} = ${running.image.value}`;
};

// This is RunnerPlacement.matches in SQL, so that a claim stays one statement.
export const placementMet = (
  clauses: SQLWrapper,
  image: SQLWrapper,
  terms: RunnerTerms,
): SQL =>
  sql`(${everyClauseMet(clauses, terms.values)} AND ${imageServed(image, terms)})`;
