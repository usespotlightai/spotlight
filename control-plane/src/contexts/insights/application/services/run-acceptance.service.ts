import type {
  RunAcceptancePort,
  RunDisposition,
} from '@insights/application/ports/run-acceptance.port';
import type { StationFactsPort } from '@insights/application/ports/station-facts.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class RunAcceptance implements RunAcceptancePort {
  constructor(private readonly facts: StationFactsPort) {}

  async acceptedAfter(runId: string): Promise<boolean> {
    const [fact] = await this.facts.ofRuns([RunId.of(runId)]);

    return fact?.firstHumanAction?.accepts ?? false;
  }

  async dispositions(
    runIds: readonly string[],
  ): Promise<ReadonlyMap<string, RunDisposition>> {
    if (runIds.length === 0) {
      return new Map();
    }

    const facts = await this.facts.ofRuns(
      [...new Set(runIds)].map((each) => RunId.of(each)),
    );

    return new Map(
      facts.map((fact) => [fact.runId.value, fact.disposition] as const),
    );
  }
}
