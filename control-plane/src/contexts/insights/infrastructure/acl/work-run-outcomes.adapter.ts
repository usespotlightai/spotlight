import type { RunOutcomeDto } from '@insights/application/dto/run-outcome.dto';
import type { RunOutcomes } from '@insights/application/services/run-outcomes.service';
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

export class WorkRunOutcomes implements RunOutcomesPort {
  constructor(private readonly outcomes: RunOutcomes) {}

  async of(
    runIds: readonly string[],
    asOf: Date | null,
  ): Promise<ReadonlyMap<string, RunOutcomeShape>> {
    const outcomes = await this.outcomes.of(
      runIds.filter((each) => each.trim()).map(RunId.of),
      asOf,
    );

    return new Map(
      outcomes.map((outcome) => [outcome.runId, shapeOf(outcome)] as const),
    );
  }
}
