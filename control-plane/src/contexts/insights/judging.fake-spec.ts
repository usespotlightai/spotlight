import { Judging } from '@insights/domain/aggregates/judging.aggregate';
import { Score } from '@insights/domain/aggregates/score.aggregate';
import { JudgingVersionConflictError } from '@insights/domain/exceptions/judging-version-conflict.error';
import { ScoreVersionConflictError } from '@insights/domain/exceptions/score-version-conflict.error';
import type { JudgingRepository } from '@insights/domain/repositories/judging.repository';
import type { ScoreRepository } from '@insights/domain/repositories/score.repository';
import { Citation } from '@insights/domain/value-objects/citation.vo';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { JudgeReason } from '@insights/domain/value-objects/judge-reason.vo';
import { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import { Rubric } from '@insights/domain/value-objects/rubric.vo';
import { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import { ScoreId } from '@insights/domain/value-objects/score-id.vo';
import type { ScoreOrigin } from '@insights/domain/value-objects/score-origin';
import { SeenEvidence } from '@insights/domain/value-objects/seen-evidence.vo';
import { FIRST_CONFIG, WORKSPACE } from '@insights/runs.fake-spec';
import { inScope, removeVersioned } from '@insights/scoped.fake-spec';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';

export const RUBRIC_VERSION = RubricVersion.of('c'.repeat(64));
export const NEXT_RUBRIC_VERSION = RubricVersion.of('d'.repeat(64));

export const CLAIMS = [
  'It retries the upload.',
  'It adds a test for the retry.',
  'It leaves the request handler alone.',
] as const;

export const rubricOf = (
  version = RUBRIC_VERSION,
  claims: readonly string[] = CLAIMS,
  passThreshold = 1,
): Rubric => Rubric.of({ claims, passThreshold, version });

export const claimsCriteria = (passThreshold = 1): JudgeCriteria =>
  JudgeCriteria.of({ claims: CLAIMS, passThreshold });

export const locationOf = (
  taskId = 'task_1',
  stationId = 'station_1',
): RunLocation =>
  RunLocation.of({
    teamId: TeamId.of('team_1'),
    lineId: LineId.of('line_1'),
    stationId: StationId.of(stationId),
    taskId: TaskId.of(taskId),
  });

export const queuedJudging = (
  runId = 'run_1',
  rubric: Rubric = rubricOf(),
  now = new Date('2026-09-30T10:00:00.000Z'),
): Judging =>
  Judging.requested({
    runId: RunId.of(runId),
    workspaceId: WORKSPACE,
    location: locationOf(),
    fingerprint: FIRST_CONFIG,
    rubric,
    now,
  });

export const reasonOf = (
  text = 'It retried in the request.',
  claim: number | null = null,
): JudgeReason =>
  JudgeReason.of({ text, citations: [Citation.ofStep(1)], claim });

export const judgeScore = (
  runId: string,
  claimResults: readonly boolean[],
  change: {
    at?: Date;
    rubricVersion?: string;
    taskId?: string;
    stationId?: string;
    passThreshold?: number;
    origin?: ScoreOrigin;
  } = {},
): Score =>
  Score.judge({
    id: ScoreId.of(`judge_${runId}_${change.rubricVersion ?? RUBRIC_VERSION}`),
    runId: RunId.of(runId),
    workspaceId: WORKSPACE,
    location: locationOf(change.taskId ?? `task_${runId}`, change.stationId),
    fingerprint: FIRST_CONFIG,
    claimResults,
    passThreshold: change.passThreshold ?? 1,
    rubricVersion: change.rubricVersion ?? RUBRIC_VERSION,
    model: 'some/model',
    reasons: claimResults.map((_, at) => reasonOf(`Claim ${at}.`, at)),
    seen: SeenEvidence.none(),
    at: change.at ?? new Date('2026-09-30T10:00:00.000Z'),
    origin: change.origin,
  });

export class JudgingsInMemory implements JudgingRepository {
  readonly stored = new Map<string, Judging>();
  readonly events: DomainEvent[] = [];

  async add(judging: Judging): Promise<void> {
    if (this.stored.has(judging.runId.value)) {
      throw new JudgingVersionConflictError(judging.runId.value);
    }
    this.events.push(...judging.pullEvents());
    this.stored.set(judging.runId.value, judging);
  }

  async save(judging: Judging): Promise<void> {
    if (judging.isDeleted) {
      return this.removed(judging);
    }

    const existing = this.stored.get(judging.runId.value);

    if (!existing || existing.version !== judging.version) {
      throw new JudgingVersionConflictError(judging.runId.value);
    }
    this.events.push(...judging.pullEvents());
    this.stored.set(
      judging.runId.value,
      Judging.rehydrate({ ...judging, version: judging.version + 1 }),
    );
  }

  async of(runId: RunId): Promise<Judging | null> {
    return this.stored.get(runId.value) ?? null;
  }

  async nextDueJob(now: Date): Promise<Judging | null> {
    return (
      [...this.stored.values()]
        .filter((each) => each.job?.isDue(now))
        .sort((a, b) => a.queuedAt.getTime() - b.queuedAt.getTime())[0] ?? null
    );
  }

  async ofScope(
    scope: DeletionScope,
    max: number,
  ): Promise<readonly Judging[]> {
    return inScope(
      this.stored,
      scope,
      (each) => ({
        workspaceId: each.workspaceId,
        teamId: each.location.teamId,
        taskId: each.location.taskId,
      }),
      max,
    );
  }

  private async removed(removed: Judging): Promise<void> {
    removeVersioned(
      this.stored,
      removed.runId.value,
      removed,
      () => new JudgingVersionConflictError(removed.runId.value),
    );
  }
}

export class ScoresInMemory implements ScoreRepository {
  readonly stored = new Map<string, Score>();
  readonly events: DomainEvent[] = [];

  async add(score: Score): Promise<void> {
    const twin = [...this.stored.values()].find(
      (each) =>
        each.runId.equals(score.runId) &&
        each.rubricVersion === score.rubricVersion,
    );

    if (this.stored.has(score.id.value) || twin) {
      throw new ScoreVersionConflictError(score.id.value);
    }
    this.events.push(...score.pullEvents());
    this.stored.set(score.id.value, score);
  }

  async save(score: Score): Promise<void> {
    if (!score.isDeleted) {
      throw new InconsistentStateError(
        'score',
        'changes only by being deleted',
      );
    }

    return this.removed(score);
  }

  async of(runId: RunId, rubricVersion: RubricVersion): Promise<Score | null> {
    return (
      [...this.stored.values()].find(
        (each) =>
          each.runId.equals(runId) && each.rubricVersion === rubricVersion,
      ) ?? null
    );
  }

  async ofScope(scope: DeletionScope, max: number): Promise<readonly Score[]> {
    return inScope(
      this.stored,
      scope,
      (each) => ({
        workspaceId: each.workspaceId,
        teamId: each.location.teamId,
        taskId: each.location.taskId,
      }),
      max,
    );
  }

  private async removed(removed: Score): Promise<void> {
    removeVersioned(
      this.stored,
      removed.id.value,
      removed,
      () => new ScoreVersionConflictError(removed.id.value),
    );
  }
}
