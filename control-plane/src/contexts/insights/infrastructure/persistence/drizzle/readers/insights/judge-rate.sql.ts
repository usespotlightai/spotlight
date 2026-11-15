import { score } from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { sql } from 'drizzle-orm';

export const passOfScore = sql`case when ${score.passes} then 1 else 0 end`;
