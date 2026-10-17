import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type {
  SearchRunFact,
  SearchRunFactsPort,
} from '@work/application/ports/search-run-facts.port';
import type {
  LeasedSearchRun,
  SearchRunStatus,
  SearchRunsPort,
} from '@work/application/ports/search-runs.port';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import {
  LEASED_RUN_STATES,
  type RunState,
} from '@work/domain/value-objects/run-state';

const isRunning = (state: RunState): boolean =>
  (LEASED_RUN_STATES as readonly RunState[]).includes(state) ||
  state === 'parked';

const statusOf = (fact: SearchRunFact): SearchRunStatus => ({
  runId: fact.runId,
  phase:
    fact.state === 'queued'
      ? 'queued'
      : isRunning(fact.state)
        ? 'running'
        : 'ended',
  failed: fact.state !== 'completed' || fact.askedAPerson,
  started: fact.startedAt !== null || fact.attempt > 1,
  queuedAt: fact.queuedAt,
  endedAt: fact.endedAt,
});

export class SearchRuns implements SearchRunsPort {
  constructor(
    private readonly runs: RunRepository,
    private readonly facts: SearchRunFactsPort,
  ) {}

  async statuses(
    runIds: readonly string[],
  ): Promise<readonly SearchRunStatus[]> {
    return (await this.facts.of(runIds)).map(statusOf);
  }

  async leasedSearchRun(
    runId: string,
    runnerId: string,
  ): Promise<LeasedSearchRun | null> {
    const run = await this.runs.findById(RunId.of(runId));
    const subject = run?.subject;

    if (
      !run?.isLeasedBy(RunnerId.of(runnerId)) ||
      !subject?.searchId ||
      !subject.iteration
    ) {
      return null;
    }

    return {
      searchId: subject.searchId.value,
      iteration: subject.iteration.value,
    };
  }
}
