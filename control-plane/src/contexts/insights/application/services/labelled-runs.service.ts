import type {
  StationFactsPort,
  StationScores,
} from '@insights/application/ports/station-facts.port';
import type { LabelledRun } from '@insights/domain/services/revision-pick';
import { MAX_LABELLED_RUNS } from '@insights/domain/services/revision-split';
import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';

const MAX_JUDGED = 500;

export class LabelledRuns {
  constructor(private readonly facts: StationFactsPort) {}

  async of(
    station: Omit<StationScores, 'rubricVersion' | 'last'>,
    rubricVersion: RubricVersion,
  ): Promise<readonly LabelledRun[]> {
    const judged = await this.facts.judgedAtStation({
      ...station,
      rubricVersion,
      last: MAX_JUDGED,
    });
    const runIds = judged.map((each) => each.runId);
    const facts = new Map(
      (await this.facts.ofRuns(runIds)).map((each) => [each.runId.value, each]),
    );

    return judged
      .flatMap((score): LabelledRun[] => {
        const label = facts.get(score.runId.value)?.humanLabel ?? null;

        return label
          ? [
              {
                runId: score.runId,
                human: label.passes,
                live: score.passes,
              },
            ]
          : [];
      })
      .slice(0, MAX_LABELLED_RUNS);
  }
}
