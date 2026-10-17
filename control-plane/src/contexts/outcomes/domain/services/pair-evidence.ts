import { InvalidScoreError } from '@outcomes/domain/exceptions/invalid-score.error';
import {
  type JudgedHunk,
  JudgeEvidence,
  type ReferenceChange,
} from '@outcomes/domain/services/judge-evidence';
import type { PairOrder } from '@outcomes/domain/value-objects/pair-order';
import { PairReason } from '@outcomes/domain/value-objects/pair-reason.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const A = 'A:';

const B = 'B:';

const REFERENCE = 'reference:';

export interface PairCitedReason {
  readonly text: string;
  readonly hunks: readonly string[];
}

export interface PairedChange {
  readonly hunks: readonly JudgedHunk[];
  readonly hunksLeftOut: number;
}

interface Side {
  readonly run: RunId;
  readonly hunks: readonly JudgedHunk[];
}

const evidenceOf = (
  side: Side,
  title: string,
  description: string | null,
): JudgeEvidence =>
  JudgeEvidence.of({
    runId: side.run,
    title,
    description,
    steps: [],
    hunks: side.hunks,
  });

const labelled = (label: string, evidence: JudgeEvidence): PairedChange => ({
  hunks: evidence.hunks.map((each) => ({ ...each, id: `${label}${each.id}` })),
  hunksLeftOut: evidence.hunksLeftOut,
});

export class PairEvidence {
  private constructor(
    private readonly run: RunId,
    private readonly against: RunId,
    readonly order: PairOrder,
    readonly title: string,
    readonly description: string | null,
    readonly a: PairedChange,
    readonly b: PairedChange,
    readonly reference: ReferenceChange | null,
  ) {}

  static of(input: {
    run: Side;
    against: Side;
    order: PairOrder;
    title: string;
    description: string | null;
    reference: readonly JudgedHunk[];
  }): PairEvidence {
    const run = evidenceOf(input.run, input.title, input.description);
    const against = evidenceOf(input.against, input.title, input.description);
    const reference = evidenceOf(
      {
        run: input.run.run,
        hunks: input.reference.map((each) => ({
          ...each,
          id: `${REFERENCE}${each.id}`,
        })),
      },
      input.title,
      input.description,
    );
    const [first, second] =
      input.order === 'run-first' ? [run, against] : [against, run];

    return new PairEvidence(
      input.run.run,
      input.against.run,
      input.order,
      run.title,
      run.description,
      labelled(A, first),
      labelled(B, second),
      reference.hunks.length > 0
        ? {
            hunks: reference.hunks,
            hunksLeftOut: reference.hunksLeftOut,
          }
        : null,
    );
  }

  get isEmpty(): boolean {
    return (
      this.a.hunks.length === 0 ||
      this.b.hunks.length === 0 ||
      this.reference === null
    );
  }

  isFor(run: RunId, against: RunId): boolean {
    return this.run.equals(run) && this.against.equals(against);
  }

  private sideOf(id: string): 'run' | 'against' {
    const inA = this.a.hunks.some((each) => each.id === id);
    const inB = this.b.hunks.some((each) => each.id === id);

    if (!inA && !inB) {
      throw new InvalidScoreError(
        'can cite only hunks the judge read',
        'reason',
      );
    }

    return inA === (this.order === 'run-first') ? 'run' : 'against';
  }

  reasonOf(cited: PairCitedReason): PairReason {
    const sides = cited.hunks.map((id) => ({ id, side: this.sideOf(id) }));
    const unlabelled = (id: string): string => id.slice(A.length);

    return PairReason.of({
      text: cited.text,
      runHunks: sides
        .filter((each) => each.side === 'run')
        .map((each) => unlabelled(each.id)),
      againstHunks: sides
        .filter((each) => each.side === 'against')
        .map((each) => unlabelled(each.id)),
    });
  }

  groundedReasons(cited: readonly PairCitedReason[]): PairReason[] {
    return cited.flatMap((each) => {
      try {
        return [this.reasonOf(each)];
      } catch (error) {
        if (error instanceof InvalidScoreError) {
          return [];
        }
        throw error;
      }
    });
  }
}
