import type { Decision } from '@change-review/domain/entities/decision.entity';
import { FilePath } from '@change-review/domain/value-objects/file-path.vo';

export class DecisionGrounds {
  private constructor(
    private readonly steps: ReadonlySet<number>,
    private readonly changed: ReadonlySet<string>,
  ) {}

  static of(input: {
    steps: readonly number[];
    changed: readonly string[];
  }): DecisionGrounds {
    return new DecisionGrounds(
      new Set(input.steps),
      new Set(
        input.changed
          .filter((each) => each.trim())
          .map((each) => FilePath.of(each).value),
      ),
    );
  }

  admits(decision: Decision): boolean {
    return (
      decision.steps.every((each) => this.steps.has(each)) &&
      decision.paths.every((each) => this.changed.has(each.value))
    );
  }
}
