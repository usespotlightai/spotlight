import type {
  AgentProblem,
  QueuedRunCancellation,
  RunEnqueueing,
  RunState,
  RunStatus,
  RunsPort,
} from '@replays/application/ports/runs.port';
import type { SearchAgent } from '@replays/domain/value-objects/search-agent.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type {
  RunOrderContract,
  RunRequesterContract,
} from '@work/application/contracts/run-order.contract';
import type { RunSpecShape } from '@work/application/contracts/run-spec.contract';
import type {
  HarnessChoiceProblem,
  HarnessCommandsPort,
} from '@work/application/ports/harness-commands.port';
import type {
  RunFactsPort,
  RunStateFact,
} from '@work/application/ports/run-facts.port';
import type { RunLeasesPort } from '@work/application/ports/run-leases.port';
import type { RunsPort as WorkRunsPort } from '@work/application/ports/runs.port';

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

export class Runs implements RunsPort {
  constructor(
    private readonly runs: WorkRunsPort,
    private readonly facts: RunFactsPort,
    private readonly leases: RunLeasesPort,
    private readonly commands: HarnessCommandsPort,
  ) {}

  async enqueue(order: RunOrderContract): Promise<RunEnqueueing> {
    const enqueued = await this.runs.enqueue(order);

    return enqueued.outcome === 'enqueued'
      ? { enqueued: true }
      : { enqueued: false, reason: enqueued.reason };
  }

  async cancel(run: RunId): Promise<{ readonly known: boolean }> {
    return { known: (await this.runs.cancel(run)).was !== 'unknown' };
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
      requester: each.requester,
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
  ): Promise<RunRequesterContract | null> {
    return (
      (await this.leases.leasedBy(run, RunnerId.of(runnerId)))?.requester ??
      null
    );
  }

  agentProblem(agent: SearchAgent): AgentProblem | null {
    const problem = this.commands.problemOf(choiceOf(agent));

    return problem
      ? { field: FIELD[problem.field], reason: problem.reason }
      : null;
  }

  commandFor(
    agent: SearchAgent,
    requester: RunRequesterContract,
    run: RunId,
  ): RunSpecShape['command'] | null {
    return this.commands.commandFor(choiceOf(agent), requester, run.value);
  }
}
