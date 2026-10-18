const STACK_PROBLEM_CODES = [
  'shape',
  'uses',
  'tests',
  'moves',
  'migration',
  'unconnected',
  'joined-layers',
] as const;

export type StackProblemCode = (typeof STACK_PROBLEM_CODES)[number];

export interface StackProblem {
  readonly code: StackProblemCode;
  readonly message: string;
}

export const shapeProblem = (message: string): StackProblem => ({
  code: 'shape',
  message,
});

export class InvalidChangeStackError extends Error {
  readonly kind = 'invalid' as const;

  constructor(readonly problems: readonly StackProblem[]) {
    super(`A change stack ${problems.map((each) => each.message).join('; ')}.`);
    this.name = 'InvalidChangeStackError';
  }

  static because(...messages: string[]): InvalidChangeStackError {
    return new InvalidChangeStackError(messages.map(shapeProblem));
  }
}
