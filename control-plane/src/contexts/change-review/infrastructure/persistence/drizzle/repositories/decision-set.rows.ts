import type { decisionSet } from '@change-review/infrastructure/persistence/drizzle/schemas/decision.schema';

export type DecisionSetRow = typeof decisionSet.$inferSelect;

export interface MergeRow {
  readonly repository: string;
  readonly commit: string;
  readonly at: Date;
}

export const draftedRunOf = (row: DecisionSetRow): string | null =>
  row.draftRunId;

export const mergeRowOf = (row: DecisionSetRow): MergeRow | null =>
  row.mergedRepository && row.mergedCommit && row.mergedAt
    ? {
        repository: row.mergedRepository,
        commit: row.mergedCommit,
        at: row.mergedAt,
      }
    : null;
