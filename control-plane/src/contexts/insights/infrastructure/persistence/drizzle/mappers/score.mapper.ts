import { Citation } from '@insights/domain/value-objects/citation.vo';
import { JudgeReason } from '@insights/domain/value-objects/judge-reason.vo';
import { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import { ScoreFact } from '@insights/domain/value-objects/score-fact.vo';
import { ScoreId } from '@insights/domain/value-objects/score-id.vo';
import { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import { SeenEvidence } from '@insights/domain/value-objects/seen-evidence.vo';
import type {
  StoredCitation,
  score,
} from '@insights/infrastructure/persistence/drizzle/schemas/insights.schema';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export type ScoreRow = typeof score.$inferSelect;

const citationOf = (stored: StoredCitation): Citation => {
  if (stored.hunk !== null) {
    return Citation.ofHunk(stored.hunk);
  }
  if (stored.step === null) {
    throw new InconsistentStateError(
      'score',
      'cites neither a step nor a hunk',
    );
  }

  return Citation.ofStep(stored.step);
};

export const storedCitation = (citation: Citation): StoredCitation => ({
  step: citation.step,
  hunk: citation.hunk,
});

export const scoreFieldsOfRow = (row: ScoreRow) => ({
  id: ScoreId.of(row.id),
  runId: RunId.of(row.runId),
  workspaceId: WorkspaceId.of(row.workspaceId),
  location: RunLocation.of({
    teamId: TeamId.of(row.teamId),
    lineId: LineId.of(row.lineId),
    stationId: StationId.of(row.stationId),
    taskId: TaskId.of(row.taskId),
  }),
  fingerprint: row.fingerprint,
  source: row.source,
  scale: ScoreScale.of(row.kind),
  value: row.value,
  claimResults: row.claimResults,
  rubricVersion: row.rubricVersion,
  model: row.model,
  reasons: row.reasons.map((each) =>
    JudgeReason.of({
      text: each.text,
      citations: each.citations.map(citationOf),
      claim: each.claim,
    }),
  ),
  seen: SeenEvidence.of(row.seen),
  by: row.scoredById ? UserId.of(row.scoredById) : null,
  at: row.at,
  version: row.version,
});

export const scoreFactOfRow = (row: ScoreRow): ScoreFact => {
  const fields = scoreFieldsOfRow(row);

  return ScoreFact.of({
    id: fields.id,
    runId: fields.runId,
    location: fields.location,
    source: fields.source,
    scale: fields.scale,
    value: fields.value,
    claimResults: fields.claimResults,
    rubricVersion: RubricVersion.optional(fields.rubricVersion),
    model: fields.model,
    reasons: fields.reasons,
    seen: fields.seen,
    by: fields.by,
    at: fields.at,
  });
};
