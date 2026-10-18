import { InvalidReplayError } from '@replays/domain/exceptions/invalid-replay.error';
import {
  checkSkipOf,
  NOT_GENERATED,
} from '@replays/domain/value-objects/check-skip';
import type { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';

const STACK_STATES = [
  'generating',
  'not-generated',
  'unchecked',
  'checking',
  'passed',
  'failed',
  'skipped',
] as const;

export type StackState = (typeof STACK_STATES)[number];

export interface StackStatus {
  readonly repository: string | null;
  readonly state: StackState;
  readonly skip: string | null;
  readonly failedAt: readonly string[];
  readonly spent: ModelSpent;
}

const generationSpentOn = (
  stacks: readonly StackStatus[],
): ModelSpent | null => {
  const [first, ...rest] = stacks;

  return first
    ? rest.reduce((spent, each) => spent.plus(each.spent), first.spent)
    : null;
};

export const CHECKS_STATES = [
  'absent',
  'generating',
  'checking',
  'passed',
  'failed',
  'none',
  'unchecked',
] as const;

export type ChecksState = (typeof CHECKS_STATES)[number];

const isChecksState = (raw: string): raw is ChecksState =>
  (CHECKS_STATES as readonly string[]).includes(raw);

const named = (stack: StackStatus, name: string, many: boolean): string =>
  many && stack.repository ? `${stack.repository}: ${name}` : name;

export class ChangeChecks {
  private constructor(
    readonly state: ChecksState,
    readonly failedAt: readonly string[],
    readonly why: string | null,
  ) {}

  static of(stacks: readonly StackStatus[]): ChangeChecks {
    if (stacks.length === 0) {
      return new ChangeChecks('absent', [], null);
    }

    const many = stacks.length > 1;
    const any = (state: StackState) =>
      stacks.filter((each) => each.state === state);

    if (any('generating').length > 0) {
      return new ChangeChecks('generating', [], null);
    }
    if (any('checking').length > 0) {
      return new ChangeChecks('checking', [], null);
    }

    const failed = any('failed');

    if (failed.length > 0) {
      return new ChangeChecks(
        'failed',
        failed.flatMap((stack) =>
          stack.failedAt.map((each) => named(stack, each, many)),
        ),
        null,
      );
    }

    const lost = stacks.find(
      (each) => each.state === 'not-generated' || each.state === 'skipped',
    );

    if (lost) {
      return new ChangeChecks(
        'unchecked',
        [],
        lost.state === 'skipped' ? checkSkipOf(lost.skip) : NOT_GENERATED,
      );
    }

    return any('passed').length > 0
      ? new ChangeChecks('passed', [], null)
      : new ChangeChecks('none', [], null);
  }

  static checking(): ChangeChecks {
    return new ChangeChecks('checking', [], null);
  }

  static rehydrate(input: {
    state: string;
    failedAt: readonly string[];
    why: string | null;
  }): ChangeChecks {
    if (!isChecksState(input.state)) {
      throw new InvalidReplayError(
        `entry checks must be one of ${CHECKS_STATES.join(', ')}, not ${input.state}`,
      );
    }

    return new ChangeChecks(input.state, [...input.failedAt], input.why);
  }

  get pending(): boolean {
    return this.state === 'generating' || this.state === 'checking';
  }

  get generated(): boolean {
    return this.state !== 'generating';
  }

  equals(other: ChangeChecks): boolean {
    return (
      this.state === other.state &&
      this.why === other.why &&
      this.failedAt.length === other.failedAt.length &&
      this.failedAt.every((each, at) => each === other.failedAt[at])
    );
  }
}

export const reviewOf = (
  stacks: readonly StackStatus[],
): [ChangeChecks, ModelSpent | null] => [
  ChangeChecks.of(stacks),
  generationSpentOn(stacks),
];
