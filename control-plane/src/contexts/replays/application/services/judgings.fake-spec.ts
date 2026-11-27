import type {
  ChangeJudgeOrder,
  ChangeJudgePort,
} from '@replays/application/ports/change-judge.port';
import type {
  PairJudgeOrder,
  PairJudgePort,
} from '@replays/application/ports/pair-judge.port';
import {
  SESSION_WAITING,
  type SessionWaiting,
} from '@replays/application/ports/session-outcomes';
import { RequestChangeJudging } from '@replays/application/services/request-change-judging.service';
import { RequestSideBySideJudging } from '@replays/application/services/request-side-by-side-judging.service';
import { ChangeJudging } from '@replays/domain/aggregates/change-judging.aggregate';
import { SideBySideJudging } from '@replays/domain/aggregates/side-by-side-judging.aggregate';
import { ChangeJudgingVersionConflictError } from '@replays/domain/exceptions/change-judging-version-conflict.error';
import { SideBySideJudgingVersionConflictError } from '@replays/domain/exceptions/side-by-side-judging-version-conflict.error';
import { NOW } from '@replays/domain/replays.fake-spec';
import type { ChangeJudgingRepository } from '@replays/domain/repositories/change-judging.repository';
import type { SideBySideJudgingRepository } from '@replays/domain/repositories/side-by-side-judging.repository';
import type { ChangeJudgingRound } from '@replays/domain/value-objects/change-judging-round.vo';
import type { ChangeJudgment } from '@replays/domain/value-objects/change-judgment';
import type { JudgingAttempt } from '@replays/domain/value-objects/judging-attempt';
import type { PairJudgment } from '@replays/domain/value-objects/pair-judgment';
import type { SideBySideJudgingRound } from '@replays/domain/value-objects/side-by-side-judging-round.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { DomainEvent } from '@shared-kernel/domain/events/domain-event';
import type { JudgeCriteria } from '@shared-kernel/domain/value-objects/judge-criteria.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';

const CLOCK: ClockPort = { now: () => NOW, sleep: async () => {} };

const TRANSACTION = {
  inTransaction: <T>(work: () => Promise<T>) => work(),
};

export class FakeChangeJudge implements ChangeJudgePort {
  awaiting = false;
  readonly orders: ChangeJudgeOrder[] = [];
  answer: ChangeJudgment = {
    judged: false,
    failure: 'unavailable',
  };

  async judge(
    order: ChangeJudgeOrder,
  ): Promise<ChangeJudgment | SessionWaiting> {
    this.orders.push(order);
    return this.awaiting ? SESSION_WAITING : this.answer;
  }

  /** The round every settled session reads back as. */
  settledRound: ChangeJudgingRound | null = null;

  roundOf(): ChangeJudgingRound | null {
    return this.settledRound;
  }
}

export class FakePairJudge implements PairJudgePort {
  awaiting = false;
  readonly orders: PairJudgeOrder[] = [];
  answer: PairJudgment = {
    judged: false,
    failure: 'unavailable',
  };

  async judge(order: PairJudgeOrder): Promise<PairJudgment | SessionWaiting> {
    this.orders.push(order);
    return this.awaiting ? SESSION_WAITING : this.answer;
  }

  /** The round every settled session reads back as. */
  settledRound: SideBySideJudgingRound | null = null;

  roundOf(): SideBySideJudgingRound | null {
    return this.settledRound;
  }
}

const changeKeyOf = (runId: RunId, attempt: JudgingAttempt): string =>
  `${runId.value}#${attempt}`;

export class InMemoryChangeJudgings implements ChangeJudgingRepository {
  readonly stored = new Map<string, ChangeJudging>();
  readonly events: DomainEvent[] = [];

  async add(judging: ChangeJudging): Promise<void> {
    const key = changeKeyOf(judging.runId, judging.attempt);

    if (this.stored.has(key)) {
      throw new ChangeJudgingVersionConflictError(judging.runId.value);
    }
    this.events.push(...judging.pullEvents());
    this.stored.set(key, judging);
  }

  async save(judging: ChangeJudging): Promise<void> {
    const key = changeKeyOf(judging.runId, judging.attempt);

    if (this.stored.get(key)?.version !== judging.version) {
      throw new ChangeJudgingVersionConflictError(judging.runId.value);
    }
    this.events.push(...judging.pullEvents());
    if (judging.isDeleted) {
      this.stored.delete(key);
      return;
    }
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
        version: judging.version + 1,
      }),
    );
  }

  async of(
    runId: RunId,
    attempt: JudgingAttempt,
  ): Promise<ChangeJudging | null> {
    return this.stored.get(changeKeyOf(runId, attempt)) ?? null;
  }

  async ofTeam(teamId: TeamId): Promise<readonly ChangeJudging[]> {
    return [...this.stored.values()].filter((each) =>
      each.teamId.equals(teamId),
    );
  }

  async nextDueJob(now: Date): Promise<ChangeJudging | null> {
    return (
      [...this.stored.values()]
        .filter((each) => each.job?.isDue(now) === true)
        .sort(
          (one, other) => one.queuedAt.getTime() - other.queuedAt.getTime(),
        )[0] ?? null
    );
  }
}

const pairKeyOf = (runId: RunId, other: RunId): string =>
  `${runId.value}#${other.value}`;

export class InMemorySideBySideJudgings implements SideBySideJudgingRepository {
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

    if (this.stored.get(key)?.version !== judging.version) {
      throw new SideBySideJudgingVersionConflictError(
        judging.runId.value,
        judging.otherRunId.value,
      );
    }
    this.events.push(...judging.pullEvents());
    if (judging.isDeleted) {
      this.stored.delete(key);
      return;
    }
    this.stored.set(
      key,
      SideBySideJudging.rehydrate({
        runId: judging.runId,
        otherRunId: judging.otherRunId,
        workspaceId: judging.workspaceId,
        teamId: judging.teamId,
        criteria: judging.criteria,
        reference: judging.reference,
        order: judging.order,
        queuedAt: judging.queuedAt,
        job: judging.job,
        judgedAt: judging.judgedAt,
        failure: judging.failure,
        version: judging.version + 1,
      }),
    );
  }

  async of(runId: RunId, otherRunId: RunId): Promise<SideBySideJudging | null> {
    return this.stored.get(pairKeyOf(runId, otherRunId)) ?? null;
  }

  async ofTeam(teamId: TeamId): Promise<readonly SideBySideJudging[]> {
    return [...this.stored.values()].filter((each) =>
      each.teamId.equals(teamId),
    );
  }

  async nextDueJob(now: Date): Promise<SideBySideJudging | null> {
    return (
      [...this.stored.values()]
        .filter((each) => each.job?.isDue(now) === true)
        .sort(
          (one, other) => one.queuedAt.getTime() - other.queuedAt.getTime(),
        )[0] ?? null
    );
  }
}

export const changeJudgingRequestsFor = (
  judgings: ChangeJudgingRepository,
): RequestChangeJudging =>
  new RequestChangeJudging(judgings, TRANSACTION, CLOCK);

export const sideBySideJudgingRequestsFor = (
  judgings: SideBySideJudgingRepository,
): RequestSideBySideJudging =>
  new RequestSideBySideJudging(judgings, TRANSACTION, CLOCK);

export const judgedOnce = async (
  judgings: ChangeJudgingRepository,
  input: {
    run: RunId;
    workspaceId: WorkspaceId;
    teamId: TeamId;
    criteria: JudgeCriteria;
  },
): Promise<void> => {
  const judged = ChangeJudging.requested({
    runId: input.run,
    workspaceId: input.workspaceId,
    teamId: input.teamId,
    criteria: input.criteria,
    reference: null,
    now: NOW,
  })
    .leaseJob(NOW)
    .recordJudgment(
      {
        judged: true,
        claimResults: input.criteria.claims.map(() => true),
        reasons: [],
        guidance: null,
        referenced: false,
        model: 'judge/model',
      },
      NOW,
    );
  judged.pullEvents();
  await judgings.add(judged);
};
