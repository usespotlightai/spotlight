import {
  SCORE_KINDS,
  ScoreScale,
} from '@outcomes/domain/value-objects/score-scale.vo';
import { score } from '@outcomes/infrastructure/persistence/drizzle/schemas/outcomes.schema';
import { sql } from 'drizzle-orm';

export const shareOfScore = sql`case ${sql.join(
  SCORE_KINDS.map((kind) => {
    const values = ScoreScale.of(kind).values;
    const lowest = Math.min(...values);
    const highest = Math.max(...values);

    return highest === lowest
      ? sql`when ${score.kind} = ${kind} then 0::float8`
      : sql`when ${score.kind} = ${kind} then (${score.value} - ${lowest}::float8) / ${highest - lowest}::float8`;
  }),
  sql` `,
)} end`;
