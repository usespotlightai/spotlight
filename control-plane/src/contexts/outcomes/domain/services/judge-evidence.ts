import { InvalidScoreError } from '@outcomes/domain/exceptions/invalid-score.error';
import { Citation } from '@outcomes/domain/value-objects/citation.vo';
import { JudgeReason } from '@outcomes/domain/value-objects/judge-reason.vo';
import { SeenEvidence } from '@outcomes/domain/value-objects/seen-evidence.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const MOST_STEPS_TOLD = 80_000;

const MOST_HUNKS_TOLD = 60_000;

const MOST_LINE_TOLD = 500;

const MOST_HUNK_LINES_TOLD = 200;

const ITEM_OVERHEAD = 64;

const MOST_TITLE_TOLD = 300;

const MOST_DESCRIPTION_TOLD = 4_000;

const REFERENCE = 'reference:';

export interface JudgedStep {
  readonly index: number;
  readonly kind: string;
  readonly tool: string | null;
  readonly text: string;
  readonly given: string | null;
  readonly returned: string | null;
}

export interface JudgedHunk {
  readonly id: string;
  readonly path: string;
  readonly header: string;
  readonly lines: readonly string[];
}

export interface ReferenceChange {
  readonly hunks: readonly JudgedHunk[];
  readonly hunksLeftOut: number;
}

export interface CitedReason {
  readonly text: string;
  readonly steps: readonly number[];
  readonly hunks: readonly string[];
}

const clipped = (text: string, most: number): string =>
  text.length > most ? `${text.slice(0, most)} …` : text;

const sizeOfStep = (step: JudgedStep): number =>
  ITEM_OVERHEAD +
  step.kind.length +
  (step.tool?.length ?? 0) +
  step.text.length +
  (step.given?.length ?? 0) +
  (step.returned?.length ?? 0);

const sizeOfHunk = (hunk: JudgedHunk): number =>
  hunk.lines.reduce(
    (sum, line) => sum + line.length,
    ITEM_OVERHEAD + hunk.id.length + hunk.path.length + hunk.header.length,
  );

const linesTold = (lines: readonly string[]): string[] => {
  const told = lines
    .slice(0, MOST_HUNK_LINES_TOLD)
    .map((line) => clipped(line, MOST_LINE_TOLD));
  const left = lines.length - told.length;

  return left > 0 ? [...told, `… ${left} more lines`] : told;
};

const latestWithin = (steps: readonly JudgedStep[]): JudgedStep[] => {
  const kept: JudgedStep[] = [];
  let used = 0;

  for (const step of [...steps].reverse()) {
    if (used + sizeOfStep(step) > MOST_STEPS_TOLD) {
      break;
    }

    kept.push(step);
    used += sizeOfStep(step);
  }

  return kept.reverse();
};

const firstWithin = (hunks: readonly JudgedHunk[]): JudgedHunk[] => {
  const kept: JudgedHunk[] = [];
  let used = 0;

  for (const hunk of hunks) {
    const told = { ...hunk, lines: linesTold(hunk.lines) };

    if (used + sizeOfHunk(told) > MOST_HUNKS_TOLD) {
      continue;
    }

    kept.push(told);
    used += sizeOfHunk(told);
  }

  return kept;
};

export class JudgeEvidence {
  private constructor(
    private readonly runId: RunId,
    readonly title: string,
    readonly description: string | null,
    readonly steps: readonly JudgedStep[],
    readonly stepsLeftOut: number,
    readonly hunks: readonly JudgedHunk[],
    readonly hunksLeftOut: number,
    readonly reference: ReferenceChange | null,
  ) {}

  static of(input: {
    runId: RunId;
    title: string;
    description: string | null;
    steps: readonly JudgedStep[];
    hunks: readonly JudgedHunk[];
  }): JudgeEvidence {
    const steps = latestWithin(input.steps);
    const hunks = firstWithin(input.hunks);

    return new JudgeEvidence(
      input.runId,
      clipped(input.title, MOST_TITLE_TOLD),
      input.description === null
        ? null
        : clipped(input.description, MOST_DESCRIPTION_TOLD),
      steps,
      input.steps.length - steps.length,
      hunks,
      input.hunks.length - hunks.length,
      null,
    );
  }

  against(reference: readonly JudgedHunk[]): JudgeEvidence {
    const told = firstWithin(
      reference.map((hunk) => ({ ...hunk, id: `${REFERENCE}${hunk.id}` })),
    );

    return new JudgeEvidence(
      this.runId,
      this.title,
      this.description,
      this.steps,
      this.stepsLeftOut,
      this.hunks,
      this.hunksLeftOut,
      told.length > 0
        ? { hunks: told, hunksLeftOut: reference.length - told.length }
        : null,
    );
  }

  get isEmpty(): boolean {
    return this.steps.length === 0 && this.hunks.length === 0;
  }

  isFor(runId: RunId): boolean {
    return this.runId.equals(runId);
  }

  reasonOf(cited: CitedReason): JudgeReason {
    const steps = cited.steps.map((index) => {
      const step = this.steps.find((each) => each.index === index);

      if (!step) {
        throw new InvalidScoreError(
          'cites only steps of its run the judge read',
          'reason',
        );
      }

      return Citation.ofStep(step.index);
    });
    const hunks = cited.hunks.map((id) => {
      const hunk = this.hunks.find((each) => each.id === id);

      if (!hunk) {
        throw new InvalidScoreError(
          'cites only hunks of its run’s changes the judge read',
          'reason',
        );
      }

      return Citation.ofHunk(hunk.id);
    });

    return JudgeReason.of({
      text: cited.text,
      citations: [...steps, ...hunks],
    });
  }

  seenFor(reasons: readonly JudgeReason[]): SeenEvidence {
    const citations = reasons.flatMap((each) => each.citations);

    return SeenEvidence.of({
      steps: this.steps.flatMap((step) =>
        citations.some((each) => each.step === step.index)
          ? [
              {
                index: step.index,
                kind: step.kind,
                tool: step.tool,
                text: step.text,
              },
            ]
          : [],
      ),
      hunks: this.hunks.filter((hunk) =>
        citations.some((each) => each.hunk === hunk.id),
      ),
    });
  }

  groundedReasons(cited: readonly CitedReason[]): JudgeReason[] {
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
