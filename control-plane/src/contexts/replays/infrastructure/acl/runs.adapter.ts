import type {
  AgentProblem,
  QueuedRunCancellation,
  ReplayTrialRun,
  RunEnqueueing,
  RunStatus,
  RunsPort,
  SearchAgentRun,
} from '@replays/application/ports/runs.port';
import type { RunState } from '@replays/domain/services/search-reconciliation';
import {
  REPLAYS_OWNER,
  ReplaysRequester,
} from '@replays/domain/value-objects/replays-requester.vo';
import type { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import type {
  HarnessChoiceProblem,
  HarnessCommands,
} from '@replays/infrastructure/acl/harness-commands';
import { WorkTrialRun } from '@replays/infrastructure/acl/work-trial-run';
import {
  type RunOrderContract,
  type RunPolicyContract,
  type RunRequesterContract,
  workingCopyKeyOf,
} from '@runs/application/contracts/run-order.contract';
import type {
  RunFactsPort,
  RunStateFact,
} from '@runs/application/ports/run-facts.port';
import type { RunLeasesPort } from '@runs/application/ports/run-leases.port';
import type { RunsPort as RunQueuePort } from '@runs/application/ports/runs.port';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';

const RUN_POLICY: RunPolicyContract = {
  holdsTurn: false,
  gated: false,
  actsBeyondItself: false,
  asks: 'recorded',
  listed: false,
  exclusive: false,
};

const SEARCH_PRIORITY = -1;

const STATE: Readonly<Record<RunStateFact, RunState>> = {
  queued: 'queued',
  claimed: 'claimed',
  suspended: 'suspended',
  completed: 'completed',
  failed: 'failed',
  cancelled: 'cancelled',
};

const FIELD: Readonly<
  Record<HarnessChoiceProblem['field'], AgentProblem['field']>
> = {
  harness: 'harness',
  model: 'model',
  effort: 'effort',
};

const choiceOf = (agent: SearchAgent) => ({
  harness: agent.harness,
  model: agent.model,
  effort: agent.effort,
});

const requesterContractOf = (
  requester: ReplaysRequester,
  team: string,
): RunRequesterContract => ({ ...requester.encoded(), team });

const workingCopyOf = (name: string) => ({
  key: workingCopyKeyOf(REPLAYS_OWNER, name),
  rejoinable: false,
  restores: 'when-continuing' as const,
});

const trialOrderOf = (run: RunId, trial: WorkTrialRun): RunOrderContract => {
  const { team, ...order } = trial.order;

  return {
    ...order,
    requester: requesterContractOf(ReplaysRequester.replayOf(run), team),
    policy: RUN_POLICY,
    workingCopy: workingCopyOf(`replay-${run.value}`),
    extensions: {
      replay: {
        archive: order.restore?.archive ?? null,
        checkouts: trial.checkouts.map((each) => ({
          path: each.path,
          commit: each.commit,
          repository: each.repository,
        })),
        movesOnAfter: [...trial.movesOnAfter.words],
      },
    },
    apiGrant: null,
    tags: {},
    line: null,
  };
};

const enqueueingOf = (
  enqueued: Awaited<ReturnType<RunQueuePort['enqueue']>>,
): RunEnqueueing =>
  enqueued.outcome === 'enqueued'
    ? { outcome: 'enqueued' }
    : { outcome: 'refused' };

export class Runs implements RunsPort {
  constructor(
    private readonly runs: RunQueuePort,
    private readonly facts: RunFactsPort,
    private readonly leases: RunLeasesPort,
    private readonly commands: HarnessCommands,
  ) {}

  async enqueueTrial({ run, trial }: ReplayTrialRun): Promise<RunEnqueueing> {
    if (!(trial instanceof WorkTrialRun)) {
      throw new InconsistentStateError(
        'replay trial',
        `${run.value} is enqueued with a trial Work did not order`,
      );
    }

    return enqueueingOf(await this.runs.enqueue(trialOrderOf(run, trial)));
  }

  async enqueueSearch(order: SearchAgentRun): Promise<RunEnqueueing> {
    const requester = requesterContractOf(order.requester, order.teamId.value);
    const command = this.commands.commandFor(
      choiceOf(order.agent),
      requester,
      order.run.value,
    );

    if (!command) {
      return { outcome: 'harness-unavailable' };
    }

    return enqueueingOf(
      await this.runs.enqueue({
        runId: order.run.value,
        workspaceId: order.workspaceId.value,
        harness: order.agent.harness,
        priority: SEARCH_PRIORITY,
        placement: {
          labelGroups: order.placement.labelGroups,
          image: order.placement.image?.value ?? null,
        },
        spec: {
          command,
          briefing: order.briefing,
          handover: { options: [], noteLimit: 0 },
          resume: {},
        },
        requester,
        policy: RUN_POLICY,
        workingCopy: workingCopyOf(`search-${order.run.value}`),
        restore: null,
        extensions: { search: {} },
        apiGrant: null,
        tags: {},
        line: null,
        refusal: null,
      }),
    );
  }

  async cancel(
    run: RunId,
    reason: string,
  ): Promise<{ readonly known: boolean }> {
    return { known: (await this.runs.cancel(run, reason)).was !== 'unknown' };
  }

  async cancelIfQueued(
    run: RunId,
    reason: string,
  ): Promise<QueuedRunCancellation> {
    const cancelled = await this.runs.cancelIfQueued(run, reason);

    switch (cancelled.outcome) {
      case 'cancelled':
        return { outcome: 'cancelled', started: cancelled.started };
      case 'claimed':
        return { outcome: 'claimed' };
      case 'ended':
        return { outcome: 'ended' };
      case 'unknown':
        return { outcome: 'unknown' };
    }
  }

  async statuses(runs: readonly RunId[]): Promise<readonly RunStatus[]> {
    return (await this.facts.of(runs)).map((each) => ({
      run: each.runId,
      requester: ReplaysRequester.decode(each.requester),
      state: STATE[each.state],
      askedAPerson: each.askedAPerson,
      started: each.started,
      queuedAt: each.queuedAt,
      endedAt: each.endedAt,
    }));
  }

  async leasedBy(
    run: RunId,
    runnerId: string,
  ): Promise<ReplaysRequester | null> {
    const leased = await this.leases.leasedBy(run, RunnerId.of(runnerId));

    return leased ? ReplaysRequester.decode(leased.requester) : null;
  }

  agentProblem(agent: SearchAgent): AgentProblem | null {
    const problem = this.commands.problemOf(choiceOf(agent));

    return problem
      ? { field: FIELD[problem.field], reason: problem.reason }
      : null;
  }
}
