import type { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { type SQL, type SQLWrapper, sql } from 'drizzle-orm';

const everyLabelGroupMatches = (
  labelGroups: SQLWrapper,
  labels: readonly string[],
): SQL => sql`NOT EXISTS (
  SELECT 1 FROM jsonb_array_elements(${labelGroups}) AS label_group
  WHERE NOT (label_group ?| ARRAY[${sql.join(
    labels.map((each) => sql`${each}`),
    sql`, `,
  )}]::text[])
)`;

const imageSupported = (image: SQLWrapper, offer: RunnerOffer): SQL => {
  const running = offer.running;

  if (!running) {
    return sql`TRUE`;
  }

  return running.isDefault
    ? sql`(${image} IS NULL OR ${image} = ${running.image.value})`
    : sql`${image} = ${running.image.value}`;
};

// This is RunnerPlacement.matches in SQL, so that a claim stays one statement.
export const placementMatches = (
  labelGroups: SQLWrapper,
  image: SQLWrapper,
  offer: RunnerOffer,
): SQL =>
  sql`(${everyLabelGroupMatches(labelGroups, offer.values)} AND ${imageSupported(image, offer)})`;
