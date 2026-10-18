import { InvalidScoreError } from '@insights/domain/exceptions/invalid-score.error';
import { Citation } from '@insights/domain/value-objects/citation.vo';
import { JudgeReason } from '@insights/domain/value-objects/judge-reason.vo';
import { SeenEvidence } from '@insights/domain/value-objects/seen-evidence.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const MAX_PROMPT_STEPS = 80_000;

const MAX_PROMPT_HUNKS = 60_000;

const MAX_PROMPT_LINE_CHARS = 500;

const MAX_PROMPT_HUNK_LINES = 200;

const ITEM_OVERHEAD = 64;

const MAX_PROMPT_TITLE_CHARS = 300;

const MAX_PROMPT_DESCRIPTION_CHARS = 4_000;

const REFERENCE = 'reference:';

export interface JudgedStep {
  readonly index: number;
  readonly kind: string;
  readonly tool: string | null;
  readonly text: string;
  readonly input: string | null;
  readonly output: string | null;
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

const clipped = (text: string, max: number): string =>
  text.length > max ? `${text.slice(0, max)} …` : text;

const sizeOfStep = (step: JudgedStep): number =>
  ITEM_OVERHEAD +
  step.kind.length +
  (step.tool?.length ?? 0) +
  step.text.length +
  (step.input?.length ?? 0) +
  (step.output?.length ?? 0);

const sizeOfHunk = (hunk: JudgedHunk): number =>
  hunk.lines.reduce(
    (sum, line) => sum + line.length,
    ITEM_OVERHEAD + hunk.id.length + hunk.path.length + hunk.header.length,
  );

const clippedLines = (lines: readonly string[]): string[] => {
  const selected = lines
    .slice(0, MAX_PROMPT_HUNK_LINES)
    .map((line) => clipped(line, MAX_PROMPT_LINE_CHARS));
  const left = lines.length - selected.length;

  return left > 0 ? [...selected, `… ${left} more lines`] : selected;
};

const latestWithin = (steps: readonly JudgedStep[]): JudgedStep[] => {
  const selected: JudgedStep[] = [];
  let used = 0;

  for (const step of [...steps].reverse()) {
    if (used + sizeOfStep(step) > MAX_PROMPT_STEPS) {
      break;
    }

    selected.push(step);
    used += sizeOfStep(step);
  }

  return selected.reverse();
};

const firstWithin = (hunks: readonly JudgedHunk[]): JudgedHunk[] => {
  const selected: JudgedHunk[] = [];
  let used = 0;

  for (const hunk of hunks) {
    const shortened = { ...hunk, lines: clippedLines(hunk.lines) };

    if (used + sizeOfHunk(shortened) > MAX_PROMPT_HUNKS) {
      continue;
    }

    selected.push(shortened);
    used += sizeOfHunk(shortened);
  }

  return selected;
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
      clipped(input.title, MAX_PROMPT_TITLE_CHARS),
      input.description === null
        ? null
        : clipped(input.description, MAX_PROMPT_DESCRIPTION_CHARS),
      steps,
      input.steps.length - steps.length,
      hunks,
      input.hunks.length - hunks.length,
      null,
    );
  }

  against(reference: readonly JudgedHunk[]): JudgeEvidence {
    const selected = firstWithin(
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
      selected.length > 0
        ? { hunks: selected, hunksLeftOut: reference.length - selected.length }
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
          'can cite only steps the judge read',
          'reason',
        );
      }

      return Citation.ofStep(step.index);
    });
    const hunks = cited.hunks.map((id) => {
      const hunk = this.hunks.find((each) => each.id === id);

      if (!hunk) {
        throw new InvalidScoreError(
          'can cite only hunks the judge read',
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
