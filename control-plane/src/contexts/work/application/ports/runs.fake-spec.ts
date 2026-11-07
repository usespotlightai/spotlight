import type {
  LeasedRunFacts,
  RunLeasesPort,
} from '@runs/application/ports/run-leases.port';
import type {
  RunTurnsPort,
  TurnFacts,
} from '@runs/application/ports/run-turns.port';
import type { RunsPort } from '@runs/application/ports/runs.port';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import {
  RUN_ENDED,
  type RunEndedIntegrationEvent,
  type RunRequesterPublished,
} from '@shared-kernel/application/integration-events/run-ended.integration-event';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { WorkRequesters } from '@work/application/services/work-requesters';
import { type Mocked, vi } from 'vitest';

export const requestedBy = {
  task(
    taskId = 'task_1',
    revision = 0,
    team: string | null = 'team_1',
  ): RunRequesterPublished {
    return {
      owner: 'work',
      kind: 'task',
      id: taskId,
      token: String(revision),
      team,
    };
  },

  chat(
    chatId = 'chat_1',
    team: string | null = 'team_1',
  ): RunRequesterPublished {
    return { owner: 'work', kind: 'chat', id: chatId, token: null, team };
  },
};

type RunEndedPart = Partial<Omit<RunEndedIntegrationEvent, 'kind'>>;

export const runEnded = (
  part: RunEndedPart = {},
): RunEndedIntegrationEvent => ({
  kind: RUN_ENDED,
  runId: 'run_1',
  workspaceId: 'ws_1',
  requester: requestedBy.task(),
  attempt: 1,
  ending: 'completed',
  outcome: 'completed',
  failure: null,
  exitCode: 0,
  message: null,
  stopped: false,
  started: true,
  askedAPerson: false,
  handsOver: true,
  reported: true,
  report: null,
  session: null,
  claimedBy: null,
  expiredLeases: 0,
  endedAt: '2026-10-02T09:30:00.000Z',
  ...part,
});

export const runFailed = (part: RunEndedPart = {}): RunEndedIntegrationEvent =>
  runEnded({
    outcome: 'failed',
    failure: 'exited',
    exitCode: 1,
    handsOver: false,
    ...part,
  });

export const runStopped = (part: RunEndedPart = {}): RunEndedIntegrationEvent =>
  runEnded({
    stopped: true,
    handsOver: false,
    message: 'A person stopped the run.',
    ...part,
  });

export const runUnprovisioned = (
  part: RunEndedPart = {},
): RunEndedIntegrationEvent =>
  runFailed({
    failure: 'unprovisioned',
    exitCode: -1,
    reported: false,
    message:
      'No runner was provisioned after 3 attempts. Last failure: no capacity',
    ...part,
  });

const NOT_REPORTED = {
  exitCode: null,
  message: null,
  stopped: false,
  handsOver: false,
  reported: false,
  report: null,
  session: null,
  claimedBy: null,
} as const;

export const runExhausted = (
  part: RunEndedPart = {},
): RunEndedIntegrationEvent =>
  runEnded({
    ...NOT_REPORTED,
    ending: 'exhausted',
    outcome: 'exhausted',
    attempt: 3,
    expiredLeases: 3,
    ...part,
  });

export const runCancelled = (
  part: RunEndedPart = {},
): RunEndedIntegrationEvent =>
  runEnded({
    ...NOT_REPORTED,
    ending: 'cancelled',
    outcome: 'cancelled',
    ...part,
  });

export const recordingRuns = (
  answers: Partial<RunsPort> = {},
): Mocked<RunsPort> => ({
  enqueue: vi.fn(answers.enqueue ?? (async () => ({ outcome: 'enqueued' }))),
  requestStop: vi.fn(
    answers.requestStop ?? (async () => ({ pendingTurn: null })),
  ),
  cancel: vi.fn(
    answers.cancel ?? (async () => ({ was: 'unknown', started: false })),
  ),
  cancelIfQueued: vi.fn(
    answers.cancelIfQueued ?? (async () => ({ outcome: 'unknown' })),
  ),
  askedAPerson: vi.fn(answers.askedAPerson ?? (async () => undefined)),
  keep: vi.fn(answers.keep ?? (async () => undefined)),
  resume: vi.fn(answers.resume ?? (async () => undefined)),
  finish: vi.fn(answers.finish ?? (async () => undefined)),
});

export const turnFacts = (part: Partial<TurnFacts> = {}): TurnFacts => ({
  runId: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  attempt: 1,
  turn: 'pending',
  outcome: { exitCode: 0, failure: null, message: null, stopped: false },
  handover: null,
  session: null,
  reportedBy: RunnerId.of('runner_1'),
  suspendedAt: new Date('2026-10-02T09:30:00.000Z'),
  stopRequested: false,
  ...part,
});

export const heldTurn = (held: TurnFacts | null) => {
  let current = held;
  const turns = {
    turnOf: async (runId: RunId, attempt: number) =>
      current?.runId.equals(runId) && current.attempt === attempt
        ? current
        : null,
  } as unknown as RunTurnsPort;
  const runs = recordingRuns({
    keep: async () => {
      current = current && { ...current, turn: 'kept' };
    },
    resume: async () => {
      current = null;
    },
    finish: async () => {
      current = null;
    },
  });

  return {
    turns,
    runs,
    hold: (facts: TurnFacts | null) => {
      current = facts;
    },
    current: () => current,
  };
};

const LEASED_AT = new Date('2026-10-02T09:00:00.000Z');

export const leasedRun = (
  part: Partial<LeasedRunFacts> = {},
): LeasedRunFacts => ({
  runId: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  state: 'claimed',
  ended: false,
  attempt: 1,
  stopRequested: false,
  turn: null,
  suspendedAt: null,
  progress: 'in-progress',
  resumable: false,
  claimedBy: RunnerId.of('runner_1'),
  harness: HarnessId.of('dev'),
  requester: requestedBy.task(),
  policy: WorkRequesters.taskPolicy,
  team: TeamId.of('team_1'),
  checkouts: [],
  check: null,
  setups: new Map(),
  placement: RunnerPlacement.anywhere(),
  queuedAt: LEASED_AT,
  startedAt: LEASED_AT,
  endedAt: null,
  started: true,
  askedAPerson: false,
  failed: false,
  exitCode: null,
  image: null,
  startedFrom: null,
  manifest: [],
  pins: [],
  ...part,
});

export class RunNotFound extends ApplicationError {
  readonly kind = 'not-found' as const;
}

export class RunNotLeased extends ApplicationError {
  readonly kind = 'conflict' as const;
}

const isLeasedBy = (run: LeasedRunFacts, runner: RunnerId): boolean =>
  run.state === 'claimed' && run.claimedBy.equals(runner);

export const runLeasesOver = (
  lookedUp: () => LeasedRunFacts | null,
): RunLeasesPort => {
  const found = (runId: RunId): LeasedRunFacts | null => {
    const run = lookedUp();

    return run?.runId.equals(runId) ? run : null;
  };
  const leased = (runId: RunId, runner: RunnerId): LeasedRunFacts | null => {
    const run = found(runId);

    return run && isLeasedBy(run, runner) ? run : null;
  };

  return {
    leasedBy: async (runId, runner) => leased(runId, runner),
    leaseOf: async (runId, runner) => {
      const run = found(runId);

      if (!run) {
        throw new RunNotFound(`Run ${runId.value} not found.`);
      }
      if (!isLeasedBy(run, runner)) {
        throw new RunNotLeased(
          `Run ${runId.value} is not leased by runner ${runner.value}.`,
        );
      }

      return run;
    },
    isStillOn: async (runId, attempt, runner) =>
      leased(runId, runner)?.attempt === attempt,
    claimedBy: async (runId, runner) =>
      found(runId)?.claimedBy.equals(runner) ?? false,
  };
};
