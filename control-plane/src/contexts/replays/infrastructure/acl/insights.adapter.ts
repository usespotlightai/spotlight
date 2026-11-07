import type {
  RunAcceptancePort,
  RunDisposition,
} from '@insights/application/ports/run-acceptance.port';
import type { InsightsPort } from '@replays/application/ports/insights.port';
import type { OriginalOutcome } from '@replays/domain/services/composition';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const outcomeOf = (disposition: RunDisposition): OriginalOutcome => {
  switch (disposition) {
    case 'accepted':
      return 'accepted';
    case 'sent-back':
      return 'sent-back';
    case 'asked':
      return 'asked';
    case 'failed':
      return 'failed';
    case 'other':
      return 'other';
  }
};

export class Insights implements InsightsPort {
  constructor(private readonly acceptance: RunAcceptancePort) {}

  acceptedAfter(run: RunId): Promise<boolean> {
    return this.acceptance.acceptedAfter(run.value);
  }

  async originalOutcomes(
    runs: readonly RunId[],
  ): Promise<ReadonlyMap<string, OriginalOutcome>> {
    const dispositions = await this.acceptance.dispositions(
      runs.map((each) => each.value),
    );

    return new Map(
      [...dispositions].map(([run, disposition]) => [
        run,
        outcomeOf(disposition),
      ]),
    );
  }
}
