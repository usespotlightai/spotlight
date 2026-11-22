import type { DecisionDispute } from '@change-review/domain/entities/decision-dispute.entity';
import { InvalidDecisionError } from '@change-review/domain/exceptions/invalid-decision.error';
import type { DecisionId } from '@change-review/domain/value-objects/decision-id.vo';
import { FilePath } from '@change-review/domain/value-objects/file-path.vo';
import { WorkingCopyPath } from '@change-review/domain/value-objects/working-copy-path.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import type { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const DECISION_KINDS = [
  'trade-off',
  'assumption',
  'limitation',
  'rejected-approach',
  'deviation',
] as const;

export type DecisionKind = (typeof DECISION_KINDS)[number];

const MAX_TITLE = 120;
const MAX_WHY = 2_000;
const MAX_ALTERNATIVES = 5;
const MAX_ALTERNATIVE = 300;
const MAX_PATHS = 20;

export interface ProposedDecision {
  readonly kind: string;
  readonly title: string;
  readonly why: string;
  readonly alternatives: readonly string[];
  readonly paths: readonly string[];
}

export type DecisionField = 'kind' | 'title' | 'why' | 'alternatives' | 'paths';

const text = (
  raw: string,
  max: number,
  what: string,
  field: DecisionField,
): string => {
  const trimmed = raw.trim();

  if (!trimmed || trimmed.length > max) {
    throw InvalidDecisionError.at(
      field,
      `${what} must be between 1 and ${max} characters`,
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
    /** The run whose agent recorded it. */
    readonly recordedIn: RunId,
    /**
     * Steps of the journal of `recordedIn` that reason it. Only decisions drafted from a run's journal, before agents
     * recorded their own, cite any; an agent's own decision cites none.
     */
    readonly journalSteps: readonly number[],
    readonly disputes: readonly DecisionDispute[],
  ) {}

  /** A decision the agent of `recordedIn` recorded itself. */
  static of(
    id: DecisionId,
    recordedIn: RunId,
    proposed: ProposedDecision,
  ): Decision {
    if (!(DECISION_KINDS as readonly string[]).includes(proposed.kind)) {
      throw InvalidDecisionError.at(
        'kind',
        `kind must be one of ${DECISION_KINDS.join(', ')}, not ${proposed.kind}`,
      );
    }

    const alternatives = proposed.alternatives.map((each) =>
      text(each, MAX_ALTERNATIVE, 'alternative', 'alternatives'),
    );

    if (alternatives.length > MAX_ALTERNATIVES) {
      throw InvalidDecisionError.at(
        'alternatives',
        `can weigh at most ${MAX_ALTERNATIVES} alternatives`,
      );
    }

    const paths = distinct(
      proposed.paths
        .filter((each) => each.trim())
        .map((each) => FilePath.of(each).value),
    ).map(FilePath.of);

    if (paths.length === 0 || paths.length > MAX_PATHS) {
      throw InvalidDecisionError.at(
        'paths',
        `must name between 1 and ${MAX_PATHS} changed files`,
      );
    }

    return new Decision(
      id,
      proposed.kind as DecisionKind,
      text(proposed.title, MAX_TITLE, 'title', 'title'),
      text(proposed.why, MAX_WHY, 'reason', 'why'),
      alternatives,
      paths,
      recordedIn,
      [],
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
    recordedIn: RunId;
    journalSteps: readonly number[];
    disputes: readonly DecisionDispute[];
  }): Decision {
    const decision = new Decision(
      input.id,
      input.kind,
      input.title,
      input.why,
      input.alternatives,
      input.paths,
      input.recordedIn,
      input.journalSteps,
      input.disputes,
    );

    if (input.disputes.some((each) => !decision.covers(each.path))) {
      throw new InconsistentStateError(
        'decision',
        'has a dispute about a file it does not cover',
      );
    }

    return decision;
  }

  equals(other: Decision): boolean {
    return this.id.equals(other.id);
  }

  /** Whether it records the same choice, so that recording it again keeps one. */
  sameAs(other: Decision): boolean {
    return (
      this.kind === other.kind &&
      this.title === other.title &&
      this.why === other.why &&
      this.paths.length === other.paths.length &&
      this.paths.every((each) => other.covers(each))
    );
  }

  covers(path: FilePath): boolean {
    return this.paths.some((each) => each.equals(path));
  }

  isWithin(repository: Repository): boolean {
    return this.paths.some((each) =>
      WorkingCopyPath.of(each.value).isWithin(repository),
    );
  }

  dispute(dispute: DecisionDispute): Decision {
    if (!this.covers(dispute.path)) {
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
      this.recordedIn,
      this.journalSteps,
      [...this.disputes, dispute],
    );
  }
}
