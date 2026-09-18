import { InvalidChangeStackError } from '@change-review/domain/exceptions/invalid-change-stack.error';
import type {
  HunkId,
  LayerId,
} from '@change-review/domain/value-objects/stack-ids';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

export const STACK_CHECK_STATES = ['waiting', 'checked', 'skipped'] as const;

export type StackCheckState = (typeof STACK_CHECK_STATES)[number];

export const CHECK_PHASES = [
  'waiting',
  'reordering',
  'checked',
  'skipped',
] as const;

export type CheckPhase = (typeof CHECK_PHASES)[number];

export const WHOLE_STEP = 'whole';

export type StepId = LayerId | typeof WHOLE_STEP;

export const MOST_CHECK_COMMAND = 500;

export const MOST_REORDERINGS = 1;

export interface CheckStep {
  readonly id: StepId;
  readonly hunks: readonly HunkId[];
}

export interface CheckedStep {
  readonly step: StepId;
  readonly passed: boolean;
  readonly output: string;
  readonly tookMs: number;
}

export interface CheckOutcome {
  readonly state: Exclude<StackCheckState, 'waiting'>;
  readonly reason: string | null;
  readonly whole: CheckedStep | null;
  readonly layers: readonly CheckedStep[];
  readonly checkedAt: Date;
}

export interface CheckEntry {
  readonly hunk: HunkId;
  readonly layer: LayerId;
}

const OUTCOME_OF: Readonly<Record<CheckPhase, CheckOutcome['state'] | null>> = {
  waiting: null,
  reordering: 'checked',
  checked: 'checked',
  skipped: 'skipped',
};

export class StackCheck {
  private constructor(
    readonly command: string,
    readonly phase: CheckPhase,
    readonly entries: readonly CheckEntry[],
    readonly rounds: number,
    readonly outcome: CheckOutcome | null,
  ) {}

  static named(command: string): StackCheck {
    const trimmed = command.trim();

    if (
      !trimmed ||
      trimmed.length > MOST_CHECK_COMMAND ||
      /[\r\n]/.test(trimmed)
    ) {
      throw InvalidChangeStackError.because(
        `needs a check command of one line and at most ${MOST_CHECK_COMMAND} characters`,
      );
    }

    return new StackCheck(trimmed, 'waiting', [], 0, null);
  }

  static rehydrate(input: {
    command: string;
    phase: CheckPhase;
    entries: readonly CheckEntry[];
    rounds: number;
    outcome: CheckOutcome | null;
  }): StackCheck {
    const found = input.outcome?.state ?? null;

    if (found !== OUTCOME_OF[input.phase]) {
      throw new InconsistentStateError(
        'change stack check',
        `is ${input.phase} with ${found ? `a ${found} outcome` : 'no outcome'}`,
      );
    }
    if (!Number.isInteger(input.rounds) || input.rounds < 0) {
      throw new InconsistentStateError(
        'change stack check',
        `has been reordered ${input.rounds} times`,
      );
    }

    return new StackCheck(
      input.command,
      input.phase,
      input.entries,
      input.rounds,
      input.outcome,
    );
  }

  get waiting(): boolean {
    return this.phase === 'waiting';
  }

  get reordering(): boolean {
    return this.phase === 'reordering';
  }

  planned(entries: readonly CheckEntry[]): StackCheck {
    this.assertIn('waiting', 'be planned');

    return new StackCheck(this.command, 'waiting', entries, this.rounds, null);
  }

  found(outcome: CheckOutcome): StackCheck {
    this.assertIn('waiting', 'take what a check found');

    const reorder =
      outcome.state === 'checked' &&
      outcome.whole?.passed === true &&
      outcome.layers.some((layer) => !layer.passed) &&
      this.rounds < MOST_REORDERINGS;

    return new StackCheck(
      this.command,
      reorder ? 'reordering' : outcome.state,
      this.entries,
      this.rounds,
      outcome,
    );
  }

  reordered(entries: readonly CheckEntry[]): StackCheck {
    this.assertIn('reordering', 'take reordered layers');

    return new StackCheck(
      this.command,
      'waiting',
      entries,
      this.rounds + 1,
      null,
    );
  }

  keptLayers(): StackCheck {
    this.assertIn('reordering', 'keep its layers');

    return new StackCheck(
      this.command,
      'checked',
      this.entries,
      this.rounds,
      this.outcome,
    );
  }

  private assertIn(phase: CheckPhase, to: string): void {
    if (this.phase !== phase) {
      throw InvalidChangeStackError.because(
        `cannot ${to} while its check is ${this.phase}`,
      );
    }
  }
}
