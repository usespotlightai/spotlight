import { Judging } from '@outcomes/domain/aggregates/judging.aggregate';
import { Score } from '@outcomes/domain/aggregates/score.aggregate';
import { JudgingMovedOnError } from '@outcomes/domain/exceptions/judging-moved-on.error';
import { ScoreMovedOnError } from '@outcomes/domain/exceptions/score-moved-on.error';
import { FIRST_CONFIG, WORKSPACE } from '@outcomes/domain/outcomes.fake-spec';
import type { JudgingRepository } from '@outcomes/domain/repositories/judging.repository';
import type {
  ScoreRepository,
  StationScores,
} from '@outcomes/domain/repositories/score.repository';
import { Citation } from '@outcomes/domain/value-objects/citation.vo';
import { JudgeReason } from '@outcomes/domain/value-objects/judge-reason.vo';
import { Rubric } from '@outcomes/domain/value-objects/rubric.vo';
import { RunPlace } from '@outcomes/domain/value-objects/run-place.vo';
import { ScoreId } from '@outcomes/domain/value-objects/score-id.vo';
import type { ScoreScale } from '@outcomes/domain/value-objects/score-scale.vo';
import { SeenEvidence } from '@outcomes/domain/value-objects/seen-evidence.vo';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const RUBRIC_VERSION = 'c'.repeat(64);
export const NEXT_RUBRIC_VERSION = 'd'.repeat(64);

export const rubricOf = (
  text = 'Did the run retry uploads?',
  version = RUBRIC_VERSION,
): Rubric => Rubric.of({ text, version });

export const placeOf = (taskId = 'task_1', stationId = 'station_1'): RunPlace =>
  RunPlace.of({
    teamId: TeamId.of('team_1'),
    lineId: 'line_1',
    stationId,
    taskId: TaskId.of(taskId),
  });

export const askedJudging = (
  runId = 'run_1',
  rubric: Rubric = rubricOf(),
  now = new Date('2026-09-30T10:00:00.000Z'),
): Judging =>
  Judging.asked({
    runId: RunId.of(runId),
    workspaceId: WORKSPACE,
    place: placeOf(),
    fingerprint: FIRST_CONFIG,
    rubric,
    now,
  });

export const reasonOf = (text = 'It retried in the request.'): JudgeReason =>
  JudgeReason.of({ text, citations: [Citation.ofStep(1)] });

export const judgeScore = (
  runId: string,
  scale: ScoreScale,
  value: number,
  change: { at?: Date; rubricVersion?: string; taskId?: string } = {},
): Score =>
  Score.judged({
    id: ScoreId.of(`judge_${runId}_${change.rubricVersion ?? RUBRIC_VERSION}`),
    runId: RunId.of(runId),
    workspaceId: WORKSPACE,
    place: placeOf(change.taskId ?? `task_${runId}`),
    fingerprint: FIRST_CONFIG,
    scale,
    value,
    rubricVersion: change.rubricVersion ?? RUBRIC_VERSION,
    model: 'some/model',
    reasons: [reasonOf()],
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
  } = {},
): Score =>
  Score.graded({
    id: ScoreId.of(`grade_${runId}_${change.by ?? 'user_ada'}`),
    runId: RunId.of(runId),
    workspaceId: WORKSPACE,
    place: placeOf(change.taskId ?? `task_${runId}`),
    fingerprint: FIRST_CONFIG,
    scale,
    value,
    rubricVersion:
      change.rubricVersion === undefined
        ? RUBRIC_VERSION
        : change.rubricVersion,
    by: UserId.of(change.by ?? 'user_ada'),
    at: change.at ?? new Date('2026-09-30T11:00:00.000Z'),
  });

export class JudgingsInMemory implements JudgingRepository {
  readonly held = new Map<string, Judging>();
  readonly events: DomainEvent[] = [];

  async add(judging: Judging): Promise<void> {
    if (this.held.has(judging.runId.value)) {
      throw new JudgingMovedOnError(judging.runId.value);
    }
    this.events.push(...judging.pullEvents());
    this.held.set(judging.runId.value, judging);
  }

  async save(judging: Judging): Promise<void> {
    const held = this.held.get(judging.runId.value);

    if (!held || held.version !== judging.version) {
      throw new JudgingMovedOnError(judging.runId.value);
    }
    this.events.push(...judging.pullEvents());
    this.held.set(
      judging.runId.value,
      Judging.rehydrate({ ...judging, version: judging.version + 1 }),
    );
  }

  async of(runId: RunId): Promise<Judging | null> {
    return this.held.get(runId.value) ?? null;
  }

  ofForScoring(runId: RunId): Promise<Judging | null> {
    return this.of(runId);
  }

  async dueForWork(now: Date): Promise<Judging | null> {
    return (
      [...this.held.values()]
        .filter((each) => each.work?.dueBy(now))
        .sort((a, b) => a.askedAt.getTime() - b.askedAt.getTime())[0] ?? null
    );
  }

  async removeForTask(taskId: TaskId): Promise<void> {
    for (const each of [...this.held.values()]) {
      if (each.place.taskId.equals(taskId)) {
        this.held.delete(each.runId.value);
      }
    }
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    for (const each of [...this.held.values()]) {
      if (
        each.workspaceId.equals(workspaceId) &&
        each.place.teamId.equals(teamId)
      ) {
        this.held.delete(each.runId.value);
      }
    }
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    for (const each of [...this.held.values()]) {
      if (each.workspaceId.equals(workspaceId)) {
        this.held.delete(each.runId.value);
      }
    }
  }
}

export class ScoresInMemory implements ScoreRepository {
  readonly held = new Map<string, Score>();
  readonly events: DomainEvent[] = [];

  async add(score: Score): Promise<void> {
    const twin = [...this.held.values()].find(
      (each) =>
        each.runId.equals(score.runId) &&
        each.source === score.source &&
        (score.fromJudge
          ? each.rubricVersion === score.rubricVersion
          : each.by?.value === score.by?.value),
    );

    if (this.held.has(score.id.value) || twin) {
      throw new ScoreMovedOnError(score.id.value);
    }
    this.events.push(...score.pullEvents());
    this.held.set(score.id.value, score);
  }

  async save(score: Score): Promise<void> {
    const held = this.held.get(score.id.value);

    if (!held || held.version !== score.version) {
      throw new ScoreMovedOnError(score.id.value);
    }
    this.events.push(...score.pullEvents());
    this.held.set(
      score.id.value,
      Score.rehydrate({
        id: score.id,
        runId: score.runId,
        workspaceId: score.workspaceId,
        place: score.place,
        fingerprint: score.fingerprint,
        source: score.source,
        scale: score.scale,
        value: score.value,
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
      [...this.held.values()].find(
        (each) =>
          each.fromJudge &&
          each.runId.equals(runId) &&
          each.rubricVersion === rubricVersion,
      ) ?? null
    );
  }

  async gradeBy(runId: RunId, by: UserId): Promise<Score | null> {
    return (
      [...this.held.values()].find(
        (each) =>
          !each.fromJudge &&
          each.runId.equals(runId) &&
          each.by?.equals(by) === true,
      ) ?? null
    );
  }

  async ofRuns(runIds: readonly RunId[]): Promise<readonly Score[]> {
    return [...this.held.values()].filter((each) =>
      runIds.some((runId) => runId.equals(each.runId)),
    );
  }

  async judgedAtStation(criteria: StationScores): Promise<readonly Score[]> {
    return [...this.held.values()]
      .filter(
        (each) =>
          each.fromJudge &&
          each.workspaceId.equals(criteria.workspaceId) &&
          each.place.teamId.equals(criteria.teamId) &&
          each.place.lineId === criteria.lineId &&
          each.place.stationId === criteria.stationId &&
          (criteria.rubricVersion === undefined ||
            each.rubricVersion === criteria.rubricVersion),
      )
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, criteria.last);
  }

  async removeForTask(taskId: TaskId): Promise<void> {
    for (const each of [...this.held.values()]) {
      if (each.place.taskId.equals(taskId)) {
        this.held.delete(each.id.value);
      }
    }
  }

  async removeForTeam(workspaceId: WorkspaceId, teamId: TeamId): Promise<void> {
    for (const each of [...this.held.values()]) {
      if (
        each.workspaceId.equals(workspaceId) &&
        each.place.teamId.equals(teamId)
      ) {
        this.held.delete(each.id.value);
      }
    }
  }

  async removeForWorkspace(workspaceId: WorkspaceId): Promise<void> {
    for (const each of [...this.held.values()]) {
      if (each.workspaceId.equals(workspaceId)) {
        this.held.delete(each.id.value);
      }
    }
  }
}
