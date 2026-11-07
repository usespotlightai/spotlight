import { Judging } from '@insights/domain/aggregates/judging.aggregate';
import { Score } from '@insights/domain/aggregates/score.aggregate';
import { JudgingVersionConflictError } from '@insights/domain/exceptions/judging-version-conflict.error';
import { ScoreVersionConflictError } from '@insights/domain/exceptions/score-version-conflict.error';
import type { JudgingRepository } from '@insights/domain/repositories/judging.repository';
import type { ScoreRepository } from '@insights/domain/repositories/score.repository';
import { Citation } from '@insights/domain/value-objects/citation.vo';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { JudgeReason } from '@insights/domain/value-objects/judge-reason.vo';
import { Rubric } from '@insights/domain/value-objects/rubric.vo';
import { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import { ScoreId } from '@insights/domain/value-objects/score-id.vo';
import type { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import { SeenEvidence } from '@insights/domain/value-objects/seen-evidence.vo';
import { FIRST_CONFIG, WORKSPACE } from '@insights/runs.fake-spec';
import { inScope, removeVersioned } from '@insights/scoped.fake-spec';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';

export const RUBRIC_VERSION = 'c'.repeat(64);
export const NEXT_RUBRIC_VERSION = 'd'.repeat(64);

export const rubricOf = (
  text: string | null = 'Did the run retry uploads?',
  version = RUBRIC_VERSION,
  claims: readonly string[] = [],
  passThreshold = 1,
): Rubric => Rubric.of({ text, claims, passThreshold, version });

const CLAIMS = [
  'It retries the upload.',
  'It adds a test for the retry.',
  'It leaves the request handler alone.',
] as const;

export const claimsCriteria = (passThreshold = 1): JudgeCriteria =>
  JudgeCriteria.of({ rubric: null, claims: CLAIMS, passThreshold });

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

const shareOf = (claimResults: readonly boolean[]): number =>
  claimResults.filter(Boolean).length / claimResults.length;

export const judgeScore = (
  runId: string,
  scale: ScoreScale,
  value: number,
  change: {
    at?: Date;
    rubricVersion?: string;
    taskId?: string;
    stationId?: string;
    claimResults?: readonly boolean[];
  } = {},
): Score =>
  Score.judge({
    id: ScoreId.of(`judge_${runId}_${change.rubricVersion ?? RUBRIC_VERSION}`),
    runId: RunId.of(runId),
    workspaceId: WORKSPACE,
    location: locationOf(change.taskId ?? `task_${runId}`, change.stationId),
    fingerprint: FIRST_CONFIG,
    scale,
    value: change.claimResults ? shareOf(change.claimResults) : value,
    claimResults: change.claimResults ?? null,
    rubricVersion: change.rubricVersion ?? RUBRIC_VERSION,
    model: 'some/model',
    reasons: change.claimResults
      ? change.claimResults.map((_, at) => reasonOf(`Claim ${at}.`, at))
      : [reasonOf()],
    seen: SeenEvidence.none(),
    at: change.at ?? new Date('2026-09-30T10:00:00.000Z'),
  });

export const personGrade = (
  runId: string,
  scale: ScoreScale,
  value: number,
  change: {
    by?: string;
    at?: Date;
    taskId?: string;
    rubricVersion?: string | null;
    claimResults?: readonly boolean[];
  } = {},
): Score =>
  Score.grade({
    id: ScoreId.of(`grade_${runId}_${change.by ?? 'user_ada'}`),
    runId: RunId.of(runId),
    workspaceId: WORKSPACE,
    location: locationOf(change.taskId ?? `task_${runId}`),
    fingerprint: FIRST_CONFIG,
    scale,
    value: change.claimResults ? shareOf(change.claimResults) : value,
    claimResults: change.claimResults ?? null,
    rubricVersion:
      change.rubricVersion === undefined
        ? RUBRIC_VERSION
        : change.rubricVersion,
    by: UserId.of(change.by ?? 'user_ada'),
    at: change.at ?? new Date('2026-09-30T11:00:00.000Z'),
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

  async remove(removed: Judging): Promise<void> {
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
        each.source === score.source &&
        (score.fromJudge
          ? each.rubricVersion === score.rubricVersion
          : each.by?.value === score.by?.value),
    );

    if (this.stored.has(score.id.value) || twin) {
      throw new ScoreVersionConflictError(score.id.value);
    }
    this.events.push(...score.pullEvents());
    this.stored.set(score.id.value, score);
  }

  async save(score: Score): Promise<void> {
    const existing = this.stored.get(score.id.value);

    if (!existing || existing.version !== score.version) {
      throw new ScoreVersionConflictError(score.id.value);
    }
    this.events.push(...score.pullEvents());
    this.stored.set(
      score.id.value,
      Score.rehydrate({
        id: score.id,
        runId: score.runId,
        workspaceId: score.workspaceId,
        location: score.location,
        fingerprint: score.fingerprint,
        source: score.source,
        scale: score.scale,
        value: score.value,
        claimResults: score.claimResults,
        rubricVersion: score.rubricVersion,
        model: score.model,
        reasons: score.reasons,
        seen: score.seen,
        by: score.by,
        at: score.at,
        version: score.version + 1,
      }),
    );
  }

  async judgeOf(runId: RunId, rubricVersion: string): Promise<Score | null> {
    return (
      [...this.stored.values()].find(
        (each) =>
          each.fromJudge &&
          each.runId.equals(runId) &&
          each.rubricVersion === rubricVersion,
      ) ?? null
    );
  }

  async gradeBy(runId: RunId, by: UserId): Promise<Score | null> {
    return (
      [...this.stored.values()].find(
        (each) =>
          !each.fromJudge &&
          each.runId.equals(runId) &&
          each.by?.equals(by) === true,
      ) ?? null
    );
  }

  async ofRuns(runIds: readonly RunId[]): Promise<readonly Score[]> {
    return [...this.stored.values()].filter((each) =>
      runIds.some((runId) => runId.equals(each.runId)),
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

  async remove(removed: Score): Promise<void> {
    removeVersioned(
      this.stored,
      removed.id.value,
      removed,
      () => new ScoreVersionConflictError(removed.id.value),
    );
  }
}
