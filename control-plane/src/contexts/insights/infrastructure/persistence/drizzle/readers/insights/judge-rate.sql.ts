import {
  SCORE_KINDS,
  ScoreScale,
} from '@insights/domain/value-objects/score-scale.vo';
import { score } from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { sql } from 'drizzle-orm';

export const rateOfScore = sql`case ${sql.join(
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
