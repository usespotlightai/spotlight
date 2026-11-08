import type {
  decisionSet,
  decisionSetMerge,
} from '@change-review/infrastructure/persistence/drizzle/schemas/decision.schema';

export type DecisionSetRow = typeof decisionSet.$inferSelect;

export type MergeRow = typeof decisionSetMerge.$inferSelect;

export const generationRunOf = (row: DecisionSetRow): string | null =>
  row.generationRunId;
