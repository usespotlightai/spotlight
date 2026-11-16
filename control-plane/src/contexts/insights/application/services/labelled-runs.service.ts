import type {
  StationFactsPort,
  StationScores,
} from '@insights/application/ports/station-facts.port';
import { humanLabelOf } from '@insights/domain/services/human-label';
import type { LabelledRun } from '@insights/domain/services/revision-pick';
import { MAX_LABELLED_RUNS } from '@insights/domain/services/revision-split';
import type { RubricVersion } from '@insights/domain/value-objects/rubric-version.vo';
import type { ScoreFact } from '@insights/domain/value-objects/score-fact.vo';

const MAX_JUDGED = 500;

const newestPerRun = (scores: readonly ScoreFact[]): readonly ScoreFact[] => {
  const newest = new Map<string, ScoreFact>();

  for (const each of scores) {
    const known = newest.get(each.runId.value);

    if (!known || known.at.getTime() < each.at.getTime()) {
      newest.set(each.runId.value, each);
    }
  }

  return [...newest.values()].sort(
    (one, other) => other.at.getTime() - one.at.getTime(),
  );
};

export class LabelledRuns {
  constructor(private readonly facts: StationFactsPort) {}

  async of(
    station: Omit<StationScores, 'rubricVersion' | 'last'>,
    rubricVersion: RubricVersion,
  ): Promise<readonly LabelledRun[]> {
    const judged = newestPerRun(
      (
        await this.facts.judgedAtStation({
          ...station,
          rubricVersion,
          last: MAX_JUDGED,
        })
      ).filter(
        (each) => each.fromJudge && each.rubricVersion === rubricVersion,
      ),
    );
    const runIds = judged.map((each) => each.runId);
    const facts = new Map(
      (await this.facts.ofRuns(runIds)).map((each) => [each.runId.value, each]),
    );
    const grades = (await this.facts.scoresOfRuns(runIds)).filter(
      (each) => !each.fromJudge,
    );

    return judged
      .flatMap((score): LabelledRun[] => {
        const label = humanLabelOf({
          rubricVersion,
          fact: facts.get(score.runId.value) ?? null,
          grades: grades.filter((each) => each.runId.equals(score.runId)),
        });

        return label
          ? [{ runId: score.runId, human: label.passes, live: score.passes }]
          : [];
      })
      .slice(0, MAX_LABELLED_RUNS);
  }
}
