import { AlertFiring } from '@insights/domain/value-objects/alert-firing.vo';
import { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import { AlertRule } from '@insights/domain/value-objects/alert-rule.vo';
import type { stationAlert } from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';

type AlertRow = typeof stationAlert.$inferSelect;

export const firingOf = (row: AlertRow): AlertFiring =>
  AlertFiring.of({
    id: AlertId.of(row.id),
    rule: AlertRule.of({
      measure: row.measure,
      [row.condition]: row.threshold,
      over: row.over,
    }),
    reading: { value: row.value, baseline: row.baseline },
    runId: RunId.of(row.runId),
    taskId: TaskId.of(row.taskId),
    firedAt: row.firedAt,
    resolvedAt: row.resolvedAt,
    clearRuns: row.clearRuns,
    lastSeen: row.lastSeenRunId ? RunId.of(row.lastSeenRunId) : null,
  });
