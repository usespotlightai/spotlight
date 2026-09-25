import { InvalidRunnerPlacementError } from '@shared-kernel/domain/exceptions/invalid-runner-placement.error';
import { distinct } from '@shared-kernel/domain/services/distinct';
import { sameOrBothNone } from '@shared-kernel/domain/services/same-or-both-none';
import type { RunnerImage } from '@shared-kernel/domain/value-objects/runner-image.vo';
import type { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';

const MOST_SELECTOR_LENGTH = 63;

type Clause = readonly string[];

const sameClause = (a: Clause, b: Clause): boolean =>
  a.length === b.length && a.every((each) => b.includes(each));

export class RunnerPlacement {
  private constructor(
    readonly clauses: readonly Clause[],
    readonly image: RunnerImage | null,
  ) {}

  static anywhere(): RunnerPlacement {
    return new RunnerPlacement([], null);
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

    return new RunnerPlacement(selectors.length > 0 ? [selectors] : [], null);
  }

  static ofClauses(
    raw: readonly Clause[],
    image: RunnerImage | null = null,
  ): RunnerPlacement {
    return RunnerPlacement.every(
      raw.map((each) => RunnerPlacement.of(each)),
    ).in(image);
  }

  static every(placements: readonly RunnerPlacement[]): RunnerPlacement {
    const clauses: Clause[] = [];

    for (const clause of placements.flatMap((each) => each.clauses)) {
      if (!clauses.some((held) => sameClause(held, clause))) {
        clauses.push(clause);
      }
    }

    const images = distinct(
      placements.flatMap((each) => (each.image ? [each.image] : [])),
    );

    if (images.length > 1) {
      throw new InvalidRunnerPlacementError(
        `run in one image, but are asked to run in ${images.map((each) => each.value).join(' and ')}`,
      );
    }

    return new RunnerPlacement(clauses, images[0] ?? null);
  }

  in(image: RunnerImage | null): RunnerPlacement {
    return new RunnerPlacement(this.clauses, image);
  }

  get isAnywhere(): boolean {
    return this.clauses.length === 0 && this.image === null;
  }

  get selectors(): readonly string[] {
    return this.clauses.flat();
  }

  or(fallback: RunnerPlacement): RunnerPlacement {
    return this.isAnywhere ? fallback : this;
  }

  admits(terms: RunnerTerms): boolean {
    return (
      this.clauses.every((clause) => clause.some((each) => terms.has(each))) &&
      terms.serves(this.image)
    );
  }

  equals(other: RunnerPlacement): boolean {
    return (
      this.clauses.length === other.clauses.length &&
      this.clauses.every((clause) =>
        other.clauses.some((each) => sameClause(each, clause)),
      ) &&
      sameOrBothNone(this.image, other.image)
    );
  }
}
