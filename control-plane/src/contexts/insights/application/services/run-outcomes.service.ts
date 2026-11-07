import {
  type RunOutcomeDto,
  runOutcomeOf,
} from '@insights/application/dto/run-outcome.dto';
import type { StationFactsPort } from '@insights/application/ports/station-facts.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import type {
  RunOutcomeShape,
  RunOutcomesPort,
} from '@work/application/ports/run-outcomes.port';

const shapeOf = (outcome: RunOutcomeDto): RunOutcomeShape => ({
  runId: outcome.runId,
  fingerprint: outcome.fingerprint,
  endedAt: outcome.endedAt,
  ending: outcome.ending,
  failure: outcome.failure,
  visit: outcome.visit,
  checks: outcome.checks,
  firstHumanAction: outcome.firstHumanAction,
  pullRequestState: outcome.pullRequestState,
});

export class RunOutcomes implements RunOutcomesPort {
  constructor(private readonly facts: StationFactsPort) {}

  async of(
    runIds: readonly string[],
    asOf: Date | null,
  ): Promise<ReadonlyMap<string, RunOutcomeShape>> {
    const facts = await this.facts.ofRuns(
      runIds.filter((each) => each.trim()).map(RunId.of),
    );

    return new Map(
      facts.flatMap((fact) => {
        const known = asOf ? fact.asOf(asOf) : fact;

        if (!known) {
          return [];
        }

        const outcome = shapeOf(runOutcomeOf(known));

        return [[outcome.runId, outcome] as const];
      }),
    );
  }
}
