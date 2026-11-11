import {
  type RunOutcomeDto,
  runOutcomeOf,
} from '@insights/application/dto/run-outcome.dto';
import type { StationFactsPort } from '@insights/application/ports/station-facts.port';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class RunOutcomes {
  constructor(private readonly facts: StationFactsPort) {}

  async of(
    runIds: readonly RunId[],
    asOf: Date | null,
  ): Promise<readonly RunOutcomeDto[]> {
    const facts = await this.facts.ofRuns(runIds);

    return facts.flatMap((fact) => {
      const known = asOf ? fact.asOf(asOf) : fact;

      return known ? [runOutcomeOf(known)] : [];
    });
  }
}
