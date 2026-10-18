import { ChangeJudging } from '@insights/domain/aggregates/change-judging.aggregate';
import { Judging } from '@insights/domain/aggregates/judging.aggregate';
import { Score } from '@insights/domain/aggregates/score.aggregate';
import { SideBySideJudging } from '@insights/domain/aggregates/side-by-side-judging.aggregate';
import { ChangeJudgingVersionConflictError } from '@insights/domain/exceptions/change-judging-version-conflict.error';
import { JudgingVersionConflictError } from '@insights/domain/exceptions/judging-version-conflict.error';
import { ScoreVersionConflictError } from '@insights/domain/exceptions/score-version-conflict.error';
import { SideBySideJudgingVersionConflictError } from '@insights/domain/exceptions/side-by-side-judging-version-conflict.error';
import type { ChangeJudgingRepository } from '@insights/domain/repositories/change-judging.repository';
import type { JudgingRepository } from '@insights/domain/repositories/judging.repository';
import type {
  ScoreRepository,
  StationScores,
  StationsScores,
} from '@insights/domain/repositories/score.repository';
import type { SideBySideJudgingRepository } from '@insights/domain/repositories/side-by-side-judging.repository';
import { FIRST_CONFIG, WORKSPACE } from '@insights/domain/runs.fake-spec';
import { byText } from '@insights/domain/services/measures';
import { Citation } from '@insights/domain/value-objects/citation.vo';
import { JudgeCriteria } from '@insights/domain/value-objects/judge-criteria.vo';
import { JudgeReason } from '@insights/domain/value-objects/judge-reason.vo';
import type { JudgingAttempt } from '@insights/domain/value-objects/judging-attempt';
import { Rubric } from '@insights/domain/value-objects/rubric.vo';
import { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import { ScoreId } from '@insights/domain/value-objects/score-id.vo';
import type { ScoreScale } from '@insights/domain/value-objects/score-scale.vo';
import { SeenEvidence } from '@insights/domain/value-objects/seen-evidence.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

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
    lineId: 'line_1',
    stationId,
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

  ofForScoring(runId: RunId): Promise<Judging | null> {
    return this.of(runId);
  }

  async nextDueJob(now: Date): Promise<Judging | null> {
    return (
      [...this.stored.values()]
        .filter((each) => each.job?.isDue(now))
        .sort((a, b) => a.queuedAt.getTime() - b.queuedAt.getTime())[0] ?? null
    );
  }

  async removeForTask(taskId: TaskId): Promise<void> {
    for (const each of [...this.stored.values()]) {
      if (each.location.taskId.equals(taskId)) {
        this.stored.delete(each.runId.value);
      }
    }
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    for (const each of [...this.stored.values()]) {
      if (
        each.workspaceId.equals(workspaceId) &&
        each.location.teamId.equals(teamId)
      ) {
        this.stored.delete(each.runId.value);
      }
    }
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    for (const each of [...this.stored.values()]) {
      if (each.workspaceId.equals(workspaceId)) {
        this.stored.delete(each.runId.value);
      }
    }
  }
}

const keyOf = (runId: RunId, attempt: JudgingAttempt): string =>
  `${runId.value}#${attempt}`;

export class ChangeJudgingsInMemory implements ChangeJudgingRepository {
  readonly stored = new Map<string, ChangeJudging>();
  readonly events: DomainEvent[] = [];

  async add(judging: ChangeJudging): Promise<void> {
    const key = keyOf(judging.runId, judging.attempt);

    if (this.stored.has(key)) {
      throw new ChangeJudgingVersionConflictError(judging.runId.value);
    }
    this.events.push(...judging.pullEvents());
    this.stored.set(key, judging);
  }

  async save(judging: ChangeJudging): Promise<void> {
    const key = keyOf(judging.runId, judging.attempt);
    const existing = this.stored.get(key);

    if (!existing || existing.version !== judging.version) {
      throw new ChangeJudgingVersionConflictError(judging.runId.value);
    }
    this.events.push(...judging.pullEvents());
    this.stored.set(
      key,
      ChangeJudging.rehydrate({
        runId: judging.runId,
        attempt: judging.attempt,
        workspaceId: judging.workspaceId,
        teamId: judging.teamId,
        criteria: judging.criteria,
        reference: judging.reference,
        queuedAt: judging.queuedAt,
        job: judging.job,
        judgedAt: judging.judgedAt,
        failure: judging.failure,
        spent: judging.spent,
        version: judging.version + 1,
      }),
    );
  }

  async of(
    runId: RunId,
    attempt: JudgingAttempt,
  ): Promise<ChangeJudging | null> {
    return this.stored.get(keyOf(runId, attempt)) ?? null;
  }

  async nextDueJob(now: Date): Promise<ChangeJudging | null> {
    return (
      [...this.stored.values()]
        .filter((each) => each.job?.isDue(now))
        .sort((a, b) => a.queuedAt.getTime() - b.queuedAt.getTime())[0] ?? null
    );
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    for (const each of [...this.stored.values()]) {
      if (each.workspaceId.equals(workspaceId) && each.teamId.equals(teamId)) {
        this.stored.delete(keyOf(each.runId, each.attempt));
      }
    }
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    for (const each of [...this.stored.values()]) {
      if (each.workspaceId.equals(workspaceId)) {
        this.stored.delete(keyOf(each.runId, each.attempt));
      }
    }
  }
}

const pairKeyOf = (runId: RunId, other: RunId): string =>
  `${runId.value}#${other.value}`;

export class SideBySideJudgingsInMemory implements SideBySideJudgingRepository {
  readonly stored = new Map<string, SideBySideJudging>();
  readonly events: DomainEvent[] = [];

  async add(judging: SideBySideJudging): Promise<void> {
    const key = pairKeyOf(judging.runId, judging.otherRunId);

    if (this.stored.has(key)) {
      throw new SideBySideJudgingVersionConflictError(
        judging.runId.value,
        judging.otherRunId.value,
      );
    }
    this.events.push(...judging.pullEvents());
    this.stored.set(key, judging);
  }

  async save(judging: SideBySideJudging): Promise<void> {
    const key = pairKeyOf(judging.runId, judging.otherRunId);
    const existing = this.stored.get(key);

    if (!existing || existing.version !== judging.version) {
      throw new SideBySideJudgingVersionConflictError(
        judging.runId.value,
        judging.otherRunId.value,
      );
    }
    this.events.push(...judging.pullEvents());
    this.stored.set(
      key,
      SideBySideJudging.rehydrate({
        runId: judging.runId,
        otherRunId: judging.otherRunId,
        workspaceId: judging.workspaceId,
        teamId: judging.teamId,
        criteria: judging.criteria,
        reference: judging.reference,
        maxAttempts: judging.maxAttempts,
        order: judging.order,
        queuedAt: judging.queuedAt,
        job: judging.job,
        judgedAt: judging.judgedAt,
        failure: judging.failure,
        spent: judging.spent,
        version: judging.version + 1,
      }),
    );
  }

  async of(runId: RunId, other: RunId): Promise<SideBySideJudging | null> {
    return this.stored.get(pairKeyOf(runId, other)) ?? null;
  }

  async nextDueJob(now: Date): Promise<SideBySideJudging | null> {
    return (
      [...this.stored.values()]
        .filter((each) => each.job?.isDue(now))
        .sort((a, b) => a.queuedAt.getTime() - b.queuedAt.getTime())[0] ?? null
    );
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    for (const [key, each] of [...this.stored.entries()]) {
      if (each.workspaceId.equals(workspaceId) && each.teamId.equals(teamId)) {
        this.stored.delete(key);
      }
    }
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    for (const [key, each] of [...this.stored.entries()]) {
      if (each.workspaceId.equals(workspaceId)) {
        this.stored.delete(key);
      }
    }
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

  async judgedAtStation(criteria: StationScores): Promise<readonly Score[]> {
    return [...this.stored.values()]
      .filter(
        (each) =>
          each.fromJudge &&
          each.workspaceId.equals(criteria.workspaceId) &&
          each.location.teamId.equals(criteria.teamId) &&
          each.location.lineId === criteria.lineId &&
          each.location.stationId === criteria.stationId &&
          (criteria.rubricVersion === undefined ||
            each.rubricVersion === criteria.rubricVersion),
      )
      .sort(
        (a, b) =>
          b.at.getTime() - a.at.getTime() || byText(b.id.value, a.id.value),
      )
      .slice(0, criteria.last);
  }

  async judgedAtStations(criteria: StationsScores): Promise<readonly Score[]> {
    const stations = [
      ...new Map(
        criteria.stations.map((each) => [
          JSON.stringify([each.lineId, each.stationId, each.rubricVersion]),
          each,
        ]),
      ).values(),
    ];
    const judged = await Promise.all(
      stations.map((each) =>
        this.judgedAtStation({
          workspaceId: criteria.workspaceId,
          teamId: criteria.teamId,
          lineId: each.lineId,
          stationId: each.stationId,
          rubricVersion: each.rubricVersion,
          last: criteria.last,
        }),
      ),
    );

    return judged.flat();
  }

  async removeForTask(taskId: TaskId): Promise<void> {
    for (const each of [...this.stored.values()]) {
      if (each.location.taskId.equals(taskId)) {
        this.stored.delete(each.id.value);
      }
    }
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    for (const each of [...this.stored.values()]) {
      if (
        each.workspaceId.equals(workspaceId) &&
        each.location.teamId.equals(teamId)
      ) {
        this.stored.delete(each.id.value);
      }
    }
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    for (const each of [...this.stored.values()]) {
      if (each.workspaceId.equals(workspaceId)) {
        this.stored.delete(each.id.value);
      }
    }
  }
}
