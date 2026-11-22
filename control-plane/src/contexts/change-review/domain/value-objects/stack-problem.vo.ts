import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';

const STACK_PROBLEM_CODES = [
  'shape',
  'uses',
  'removes',
  'tests',
  'moves',
  'migration',
  'unconnected',
  'joined-layers',
] as const;

export type StackProblemCode = (typeof STACK_PROBLEM_CODES)[number];

/** A rule a drafted change stack broke. The stack keeps the problems of its last draft for the next draft to fix. */
export class StackProblem {
  private constructor(
    readonly code: StackProblemCode,
    readonly message: string,
  ) {}

  static of(code: StackProblemCode, message: string): StackProblem {
    const said = message.trim();

    if (!said) {
      throw new InconsistentStateError(
        'stack problem',
        'does not say what is wrong',
      );
    }

    return new StackProblem(code, said);
  }

  /** A problem with the shape of the stack, rather than with a fact of the diff. */
  static shape(message: string): StackProblem {
    return StackProblem.of('shape', message);
  }

  equals(other: StackProblem): boolean {
    return this.code === other.code && this.message === other.message;
  }
}
