import type { Decision } from '@change-review/domain/entities/decision.entity';
import { FilePath } from '@change-review/domain/value-objects/file-path.vo';

export class DecisionEvidence {
  private constructor(
    private readonly steps: ReadonlySet<number>,
    private readonly changed: ReadonlySet<string>,
  ) {}

  static of(input: {
    steps: readonly number[];
    changed: readonly string[];
  }): DecisionEvidence {
    return new DecisionEvidence(
      new Set(input.steps),
      new Set(
        input.changed
          .filter((each) => each.trim())
          .map((each) => FilePath.of(each).value),
      ),
    );
  }

  supports(decision: Decision): boolean {
    return (
      decision.journalSteps.every((each) => this.steps.has(each)) &&
      decision.paths.every((each) => this.changed.has(each.value))
    );
  }
}
