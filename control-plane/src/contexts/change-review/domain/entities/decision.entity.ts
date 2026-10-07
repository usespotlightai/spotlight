import type { DecisionDispute } from '@change-review/domain/entities/decision-dispute.entity';
import { InvalidDecisionError } from '@change-review/domain/exceptions/invalid-decision.error';
import type { DecisionId } from '@change-review/domain/value-objects/decision-id.vo';
import { FilePath } from '@change-review/domain/value-objects/file-path.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export const DECISION_KINDS = [
  'trade-off',
  'assumption',
  'limitation',
  'rejected-approach',
  'deviation',
] as const;

export type DecisionKind = (typeof DECISION_KINDS)[number];

const MOST_TITLE = 120;
const MOST_WHY = 2_000;
const MOST_ALTERNATIVES = 5;
const MOST_ALTERNATIVE = 300;
const MOST_PATHS = 20;
const MOST_STEPS = 20;

export interface ProposedDecision {
  readonly kind: string;
  readonly title: string;
  readonly why: string;
  readonly alternatives: readonly string[];
  readonly paths: readonly string[];
  readonly steps: readonly number[];
}

const text = (raw: string, most: number, what: string): string => {
  const trimmed = raw.trim();

  if (!trimmed || trimmed.length > most) {
    throw new InvalidDecisionError(
      `${what} must be at most ${most} characters`,
    );
  }

  return trimmed;
};

const distinct = <T>(values: readonly T[]): T[] => [...new Set(values)];

export class Decision {
  private constructor(
    readonly id: DecisionId,
    readonly kind: DecisionKind,
    readonly title: string,
    readonly why: string,
    readonly alternatives: readonly string[],
    readonly paths: readonly FilePath[],
    readonly steps: readonly number[],
    readonly disputes: readonly DecisionDispute[],
  ) {}

  static of(id: DecisionId, proposed: ProposedDecision): Decision {
    if (!(DECISION_KINDS as readonly string[]).includes(proposed.kind)) {
      throw new InvalidDecisionError(
        `kind must be one of ${DECISION_KINDS.join(', ')}, not ${proposed.kind}`,
      );
    }

    const alternatives = proposed.alternatives.map((each) =>
      text(each, MOST_ALTERNATIVE, 'alternative'),
    );

    if (alternatives.length > MOST_ALTERNATIVES) {
      throw new InvalidDecisionError(
        `can weigh at most ${MOST_ALTERNATIVES} alternatives`,
      );
    }

    const paths = distinct(
      proposed.paths
        .filter((each) => each.trim())
        .map((each) => FilePath.of(each).value),
    ).map(FilePath.of);

    if (paths.length === 0 || paths.length > MOST_PATHS) {
      throw new InvalidDecisionError(
        `must name between 1 and ${MOST_PATHS} paths`,
      );
    }

    const steps = distinct(proposed.steps).sort((a, b) => a - b);

    if (
      steps.length === 0 ||
      steps.length > MOST_STEPS ||
      steps.some((each) => !Number.isInteger(each) || each < 0)
    ) {
      throw new InvalidDecisionError(
        `must cite between 1 and ${MOST_STEPS} steps of its run`,
      );
    }

    return new Decision(
      id,
      proposed.kind as DecisionKind,
      text(proposed.title, MOST_TITLE, 'title'),
      text(proposed.why, MOST_WHY, 'reason'),
      alternatives,
      paths,
      steps,
      [],
    );
  }

  static rehydrate(input: {
    id: DecisionId;
    kind: DecisionKind;
    title: string;
    why: string;
    alternatives: readonly string[];
    paths: readonly FilePath[];
    steps: readonly number[];
    disputes: readonly DecisionDispute[];
  }): Decision {
    const decision = new Decision(
      input.id,
      input.kind,
      input.title,
      input.why,
      input.alternatives,
      input.paths,
      input.steps,
      input.disputes,
    );

    if (input.disputes.some((each) => !decision.bearsOn(each.path))) {
      throw new InconsistentStateError(
        'decision',
        'holds a dispute about a file it does not bear on',
      );
    }

    return decision;
  }

  equals(other: Decision): boolean {
    return this.id.equals(other.id);
  }

  bearsOn(path: FilePath): boolean {
    return this.paths.some((each) => each.equals(path));
  }

  disputed(dispute: DecisionDispute): Decision {
    if (!this.bearsOn(dispute.path)) {
      throw new InvalidDecisionError(
        `can only be disputed on a file it covers, not ${dispute.path.value}`,
      );
    }

    return new Decision(
      this.id,
      this.kind,
      this.title,
      this.why,
      this.alternatives,
      this.paths,
      this.steps,
      [...this.disputes, dispute],
    );
  }
}
