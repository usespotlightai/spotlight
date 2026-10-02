import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import type {
  SearchRunFact,
  SearchRunFactsPort,
} from '@work/application/ports/search-run-facts.port';
import type {
  HeldSearchRun,
  SearchRunStanding,
  SearchRunsPort,
} from '@work/application/ports/search-runs.port';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import {
  HELD_RUN_STATES,
  type RunState,
} from '@work/domain/value-objects/run-state';

const held = (state: RunState): boolean =>
  (HELD_RUN_STATES as readonly RunState[]).includes(state) ||
  state === 'parked';

const standingOf = (fact: SearchRunFact): SearchRunStanding => ({
  runId: fact.runId,
  phase:
    fact.state === 'queued' ? 'queued' : held(fact.state) ? 'running' : 'ended',
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

  async standing(
    runIds: readonly string[],
  ): Promise<readonly SearchRunStanding[]> {
    return (await this.facts.of(runIds)).map(standingOf);
  }

  async heldSearchRun(
    runId: string,
    runnerId: string,
  ): Promise<HeldSearchRun | null> {
    const run = await this.runs.findById(RunId.of(runId));
    const subject = run?.subject;

    if (
      !run?.isHeldBy(RunnerId.of(runnerId)) ||
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
