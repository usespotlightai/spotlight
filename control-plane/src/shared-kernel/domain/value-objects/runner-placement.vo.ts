import { InvalidRunnerPlacementError } from '@shared-kernel/domain/exceptions/invalid-runner-placement.error';
import type { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';

const MOST_SELECTOR_LENGTH = 63;

type Clause = readonly string[];

const sameClause = (a: Clause, b: Clause): boolean =>
  a.length === b.length && a.every((each) => b.includes(each));

export class RunnerPlacement {
  private constructor(readonly clauses: readonly Clause[]) {}

  static anywhere(): RunnerPlacement {
    return new RunnerPlacement([]);
  }

  static of(raw: readonly string[]): RunnerPlacement {
    const selectors: string[] = [];

    for (const each of raw) {
      const trimmed = each.trim();

      if (
        !trimmed ||
        trimmed.length > MOST_SELECTOR_LENGTH ||
        /[\r\n]/.test(trimmed)
      ) {
        throw new InvalidRunnerPlacementError(
          `are each named by a runner name or label of at most ${MOST_SELECTOR_LENGTH} characters`,
        );
      }

      if (selectors.includes(trimmed)) {
        throw new InvalidRunnerPlacementError(`name ${trimmed} only once`);
      }

      selectors.push(trimmed);
    }

    return new RunnerPlacement(selectors.length > 0 ? [selectors] : []);
  }

  static ofClauses(raw: readonly Clause[]): RunnerPlacement {
    return RunnerPlacement.every(raw.map((each) => RunnerPlacement.of(each)));
  }

  static every(placements: readonly RunnerPlacement[]): RunnerPlacement {
    const clauses: Clause[] = [];

    for (const clause of placements.flatMap((each) => each.clauses)) {
      if (!clauses.some((held) => sameClause(held, clause))) {
        clauses.push(clause);
      }
    }

    return new RunnerPlacement(clauses);
  }

  get isAnywhere(): boolean {
    return this.clauses.length === 0;
  }

  get selectors(): readonly string[] {
    return this.clauses.flat();
  }

  or(fallback: RunnerPlacement): RunnerPlacement {
    return this.isAnywhere ? fallback : this;
  }

  admits(terms: RunnerTerms): boolean {
    return this.clauses.every((clause) =>
      clause.some((each) => terms.has(each)),
    );
  }

  equals(other: RunnerPlacement): boolean {
    return (
      this.clauses.length === other.clauses.length &&
      this.clauses.every((clause) =>
        other.clauses.some((each) => sameClause(each, clause)),
      )
    );
  }
}
