import type {
  FiredAlert,
  StationFactsPort,
  StationRuns,
  StationScores,
  StationsScores,
} from '@insights/application/ports/station-facts.port';
import { PullRequestRecord } from '@insights/domain/aggregates/pull-request-record.aggregate';
import { RunRecord } from '@insights/domain/aggregates/run-record.aggregate';
import type { Score } from '@insights/domain/aggregates/score.aggregate';
import type { StationAlertState } from '@insights/domain/aggregates/station-alert-state.aggregate';
import type { TaskFailures } from '@insights/domain/aggregates/task-failures.aggregate';
import type { TaskHumanActions } from '@insights/domain/aggregates/task-human-actions.aggregate';
import { RunRecordVersionConflictError } from '@insights/domain/exceptions/run-record-version-conflict.error';
import type {
  RecordsOwner,
  RunRecordRepository,
} from '@insights/domain/repositories/run-record.repository';
import {
  type ConfigIntervalBound,
  earliestBounds,
} from '@insights/domain/services/config-intervals';
import type { LocatedFailure } from '@insights/domain/services/failure-summaries';
import {
  inStartOrder,
  type StartedRun,
  startOf,
} from '@insights/domain/services/run-order';
import type { AlertId } from '@insights/domain/value-objects/alert-id.vo';
import { ConfigFingerprint } from '@insights/domain/value-objects/config-fingerprint.vo';
import type { DeletionScope } from '@insights/domain/value-objects/deletion-scope.vo';
import { RunAgentConfig } from '@insights/domain/value-objects/run-agent-config.vo';
import { RunEnd } from '@insights/domain/value-objects/run-end.vo';
import type { RunEnding } from '@insights/domain/value-objects/run-ending';
import type { RunFact } from '@insights/domain/value-objects/run-fact.vo';
import { RunLocation } from '@insights/domain/value-objects/run-location.vo';
import { RunTools } from '@insights/domain/value-objects/run-tools.vo';
import { RunUsage } from '@insights/domain/value-objects/run-usage.vo';
import { ScoreFact } from '@insights/domain/value-objects/score-fact.vo';
import { inScope, removeVersioned } from '@insights/scoped.fake-spec';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

export const WORKSPACE = WorkspaceId.of('ws_1');
export const TEAM = TeamId.of('team_1');
export const FIRST_CONFIG = ConfigFingerprint.of('a'.repeat(64));
export const SECOND_CONFIG = ConfigFingerprint.of('b'.repeat(64));

const locationOf = (taskId = 'task_1', stationId = 'station_1'): RunLocation =>
  RunLocation.of({
    teamId: TEAM,
    lineId: LineId.of('line_1'),
    stationId: StationId.of(stationId),
    taskId: TaskId.of(taskId),
  });

export const endOf = (
  change: {
    taskId?: string;
    stationId?: string;
    fingerprint?: string | null;
    endedAt?: Date;
    queuedAt?: Date | null;
    startedAt?: Date | null;
    ending?: RunEnding;
    failure?: string | null;
    visit?: number;
    asked?: boolean;
    harness?: string;
    model?: string | null;
    effort?: string | null;
    profileKey?: string | null;
    repositories?: readonly string[];
    skills?: readonly string[];
  } = {},
): RunEnd =>
  RunEnd.of({
    location: locationOf(change.taskId, change.stationId),
    fingerprint:
      change.fingerprint === undefined ? FIRST_CONFIG : change.fingerprint,
    agentConfig: RunAgentConfig.of({
      harness: change.harness ?? 'claude-code',
      model: change.model === undefined ? 'sonnet' : change.model,
      effort: change.effort ?? null,
      profileKey: change.profileKey ?? null,
      repositories: change.repositories ?? ['acme/api'],
      skills: change.skills ?? [],
    }),
    queuedAt: change.queuedAt === undefined ? null : change.queuedAt,
    startedAt: change.startedAt === undefined ? null : change.startedAt,
    endedAt: change.endedAt ?? new Date('2026-09-30T10:00:00.000Z'),
    ending: change.ending ?? 'completed',
    failure: change.failure ?? null,
    visit: change.visit ?? 1,
    asked: change.asked ?? false,
  });

export const usageOf = (
  change: {
    ms?: number | null;
    amount?: number | null;
    currency?: string | null;
    steps?: number;
    changedLines?: number;
  } = {},
): RunUsage =>
  RunUsage.of({
    ms: change.ms === undefined ? 60_000 : change.ms,
    steps: change.steps ?? 10,
    errors: 0,
    changedLines: change.changedLines ?? 0,
    contextTokens: 1_000,
    contextWindow: null,
    amount: change.amount === undefined ? 0.5 : change.amount,
    currency: change.currency === undefined ? 'USD' : change.currency,
    tokens: { input: null, output: null, cacheRead: null, cacheWrite: null },
  });

export const endedRecord = (
  runId: string,
  change: Parameters<typeof endOf>[0] = {},
): RunRecord =>
  RunRecord.empty(RunId.of(runId), WORKSPACE).recordEnd(endOf(change));

export const costedRecord = (
  runId: string,
  change: NonNullable<Parameters<typeof endOf>[0]> &
    NonNullable<Parameters<typeof usageOf>[0]> & { tools?: RunTools } = {},
): RunRecord =>
  endedRecord(runId, change).recordUsage(
    usageOf(change),
    change.tools ?? RunTools.NONE,
  );

export const factOf = (record: RunRecord): RunFact => {
  const fact = record.factWith(null, null);

  if (!fact) {
    throw new Error(`run ${record.runId.value} has not ended`);
  }

  return fact;
};

export const factsWith = (
  records: readonly RunRecord[],
  pullRequests: readonly PullRequestRecord[] = [],
): readonly RunFact[] =>
  records.flatMap((record) => {
    const fact = record.factWith(
      null,
      PullRequestRecord.latestOwnedOf(
        pullRequests.filter(
          (each) =>
            record.taskId !== null && each.owner?.taskId.equals(record.taskId),
        ),
      ),
    );

    return fact ? [fact] : [];
  });

const fromBound = (run: StartedRun, bound: ConfigIntervalBound): boolean =>
  run.beganAt.getTime() > bound.from.getTime() ||
  (run.beganAt.getTime() === bound.from.getTime() &&
    (bound.fromRun === undefined || run.runId.value >= bound.fromRun.value));

export const lastConfigRunsFrom = (
  facts: readonly RunFact[],
  bounds: readonly ConfigIntervalBound[],
): readonly RunFact[] => {
  const earliest = earliestBounds(bounds);
  const last = new Map<string, RunFact>();

  for (const fact of [...facts].sort((one, other) =>
    inStartOrder(startOf(one), startOf(other)),
  )) {
    const bound = earliest.get(fact.end.location.stationId.value);

    if (fact.end.ranAConfig && bound && !fromBound(startOf(fact), bound)) {
      last.set(fact.end.location.stationId.value, fact);
    }
  }

  return [...last.values()];
};

export class RunRecordsInMemory implements RunRecordRepository {
  readonly stored = new Map<string, RunRecord>();
  readonly raised: DomainEvent[] = [];

  async add(record: RunRecord): Promise<void> {
    if (this.stored.has(record.runId.value)) {
      throw new RunRecordVersionConflictError(record.runId.value);
    }
    this.raised.push(...record.pullEvents());
    this.stored.set(record.runId.value, record);
  }

  async save(record: RunRecord): Promise<void> {
    const existing = this.stored.get(record.runId.value);

    if (!existing || existing.version !== record.version) {
      throw new RunRecordVersionConflictError(record.runId.value);
    }
    this.raised.push(...record.pullEvents());
    this.stored.set(
      record.runId.value,
      RunRecord.rehydrate({ ...record, version: record.version + 1 }),
    );
  }

  async of(runId: RunId): Promise<RunRecord | null> {
    return this.stored.get(runId.value) ?? null;
  }

  async ofRuns(runIds: readonly RunId[]): Promise<readonly RunRecord[]> {
    return runIds.flatMap((each) => {
      const existing = this.stored.get(each.value);
      return existing ? [existing] : [];
    });
  }

  async ofTasks(taskIds: readonly TaskId[]): Promise<readonly RunRecord[]> {
    return [...this.stored.values()].filter((each) =>
      taskIds.some((taskId) => each.taskId?.equals(taskId)),
    );
  }

  async ofTaskAt(
    taskId: TaskId,
    stationId: StationId,
  ): Promise<readonly RunRecord[]> {
    return this.ended().filter(
      (each) =>
        each.end?.location.taskId.equals(taskId) &&
        each.end.location.stationId.equals(stationId),
    );
  }

  async runIdsOf(
    owner: RecordsOwner,
    after: RunId | null,
    max: number,
  ): Promise<readonly RunId[]> {
    return [...this.stored.values()]
      .filter(
        (each) =>
          each.workspaceId.equals(owner.workspaceId) &&
          (owner.teamId === null ||
            each.end?.location.teamId.equals(owner.teamId) === true) &&
          (after === null || each.runId.value > after.value),
      )
      .map((each) => each.runId)
      .sort((one, other) => (one.value < other.value ? -1 : 1))
      .slice(0, max);
  }

  async endedSince(
    since: Date,
    after: RunId | null,
    max: number,
  ): Promise<readonly RunRecord[]> {
    return this.ended()
      .filter(
        (each) =>
          (each.end?.endedAt.getTime() ?? 0) >= since.getTime() &&
          (after === null || each.runId.value > after.value),
      )
      .sort((one, other) => (one.runId.value < other.runId.value ? -1 : 1))
      .slice(0, max);
  }

  ended(): RunRecord[] {
    return [...this.stored.values()].filter((each) => each.hasEnded);
  }

  async ofScope(
    scope: DeletionScope,
    max: number,
  ): Promise<readonly RunRecord[]> {
    return inScope(
      this.stored,
      scope,
      (each) => ({
        workspaceId: each.workspaceId,
        teamId: each.end?.location.teamId ?? null,
        taskId: each.taskId,
      }),
      max,
    );
  }

  async remove(removed: RunRecord): Promise<void> {
    removeVersioned(
      this.stored,
      removed.runId.value,
      removed,
      () => new RunRecordVersionConflictError(removed.runId.value),
    );
  }
}

export interface FactSources {
  readonly alertStates?: {
    ofAlert(alertId: AlertId): Promise<StationAlertState | null>;
  };
  readonly pullRequests?: {
    ownedBy(taskIds: readonly TaskId[]): Promise<readonly PullRequestRecord[]>;
  };
  readonly humanActions?: {
    ofTasks(taskIds: readonly TaskId[]): Promise<readonly TaskHumanActions[]>;
  };
  readonly scores?: { readonly stored: ReadonlyMap<string, Score> };
  readonly failures?: { readonly stored: ReadonlyMap<string, TaskFailures> };
}

export const scoreFactOf = (score: Score): ScoreFact =>
  ScoreFact.of({
    id: score.id,
    runId: score.runId,
    location: score.location,
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
  });

export class StationFactsInMemory implements StationFactsPort {
  constructor(
    private readonly records: RunRecordsInMemory,
    private readonly sources: FactSources = {},
  ) {}

  async firedAlert(alertId: AlertId): Promise<FiredAlert | null> {
    const alertState = await this.sources.alertStates?.ofAlert(alertId);
    const firing = alertState?.firing(alertId);

    return alertState && firing
      ? { station: alertState.station, firing }
      : null;
  }

  async facts(): Promise<readonly RunFact[]> {
    const ended = this.records.ended();
    const tasks = [
      ...new Set(
        ended.flatMap((each) => (each.taskId ? [each.taskId.value] : [])),
      ),
    ].map(TaskId.of);
    const owned = (await this.sources.pullRequests?.ownedBy(tasks)) ?? [];
    const opened = (await this.sources.humanActions?.ofTasks(tasks)) ?? [];

    return ended.flatMap((record) => {
      const taskId = record.taskId;
      const opening = opened.find(
        (each) => taskId !== null && each.taskId.equals(taskId),
      )?.opening;
      const fact = record.factWith(
        opening ? { by: opening.by, at: opening.at } : null,
        PullRequestRecord.latestOwnedOf(
          owned.filter(
            (each) => taskId !== null && each.owner?.taskId.equals(taskId),
          ),
        ),
      );

      return fact ? [fact] : [];
    });
  }

  async latestStartedAt(runs: StationRuns): Promise<readonly RunFact[]> {
    return (await this.atStation(runs))
      .sort((one, other) => inStartOrder(startOf(other), startOf(one)))
      .slice(0, runs.last);
  }

  async lastEndedAt(runs: StationRuns): Promise<readonly RunFact[]> {
    return (await this.atStation(runs))
      .sort((a, b) => b.end.endedAt.getTime() - a.end.endedAt.getTime())
      .slice(0, runs.last);
  }

  async lastConfigRunsBefore(
    teamId: TeamId,
    bounds: readonly ConfigIntervalBound[],
  ): Promise<readonly RunFact[]> {
    return lastConfigRunsFrom(
      (await this.facts()).filter((each) =>
        each.end.location.teamId.equals(teamId),
      ),
      bounds,
    );
  }

  async ofRuns(runIds: readonly RunId[]): Promise<readonly RunFact[]> {
    return (await this.facts()).filter((each) =>
      runIds.some((runId) => runId.equals(each.runId)),
    );
  }

  async ofTasks(taskIds: readonly TaskId[]): Promise<readonly RunFact[]> {
    return (await this.facts()).filter((each) =>
      taskIds.some((taskId) => taskId.equals(each.taskId)),
    );
  }

  async failuresOfRuns(
    runIds: readonly RunId[],
  ): Promise<readonly LocatedFailure[]> {
    const wanted = new Set(runIds.map((each) => each.value));

    return [...(this.sources.failures?.stored.values() ?? [])]
      .sort((one, other) => (one.taskId.value < other.taskId.value ? -1 : 1))
      .flatMap((each) =>
        each.occurrences
          .filter(
            (occurrence) =>
              occurrence.runId !== null && wanted.has(occurrence.runId),
          )
          .map((occurrence) => ({ taskId: each.taskId.value, occurrence })),
      );
  }

  async scoresOfRuns(runIds: readonly RunId[]): Promise<readonly ScoreFact[]> {
    return this.scores().filter((each) =>
      runIds.some((runId) => runId.equals(each.runId)),
    );
  }

  async judgedAtStation(
    criteria: StationScores,
  ): Promise<readonly ScoreFact[]> {
    return [...(this.sources.scores?.stored.values() ?? [])]
      .filter(
        (each) =>
          each.fromJudge &&
          each.workspaceId.equals(criteria.workspaceId) &&
          each.location.teamId.equals(criteria.teamId) &&
          each.location.lineId.equals(criteria.lineId) &&
          each.location.stationId.equals(criteria.stationId) &&
          (criteria.rubricVersion === undefined ||
            each.rubricVersion === criteria.rubricVersion),
      )
      .sort(
        (a, b) =>
          b.at.getTime() - a.at.getTime() ||
          (b.id.value < a.id.value ? -1 : b.id.value > a.id.value ? 1 : 0),
      )
      .slice(0, criteria.last)
      .map(scoreFactOf);
  }

  async judgedAtStations(
    criteria: StationsScores,
  ): Promise<readonly ScoreFact[]> {
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

  private scores(): readonly ScoreFact[] {
    return [...(this.sources.scores?.stored.values() ?? [])].map(scoreFactOf);
  }

  private async atStation(runs: StationRuns): Promise<RunFact[]> {
    return (await this.facts()).filter(
      (each) =>
        each.workspaceId.equals(runs.workspaceId) &&
        each.end.location.teamId.equals(runs.teamId) &&
        each.end.location.stationId.equals(runs.stationId) &&
        (runs.lineId === null || each.end.location.lineId.equals(runs.lineId)),
    );
  }
}

export const SET_UP = {
  harness: 'claude-code',
  model: 'sonnet',
  effort: null,
  profileKey: null,
  repositories: ['acme/api'],
  skills: [],
  queuedAt: new Date('2026-09-01T00:00:00.000Z'),
  startedAt: null,
};

export const NOBODY_ELSE = {
  viewerOf: async () => null,
  namesOf: async () => new Map<string, string>(),
};

export const inTransaction = {
  inTransaction: <T>(work: () => Promise<T>): Promise<T> => work(),
};
