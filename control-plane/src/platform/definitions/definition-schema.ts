import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';
import { z } from 'zod';

const reasonOf = (error: unknown): string => {
  if (
    error instanceof Error &&
    'because' in error &&
    typeof error.because === 'string'
  ) {
    return error.because;
  }

  return error instanceof Error ? error.message : String(error);
};

export const refinedBy =
  <T>(make: (raw: T) => unknown) =>
  (raw: T, context: z.RefinementCtx<T>): void => {
    try {
      make(raw);
    } catch (error) {
      context.addIssue({ code: 'custom', message: reasonOf(error) });
    }
  };

export const madeBy = (make: (raw: string) => unknown) =>
  z.string().superRefine(refinedBy(make));

export const problemsIn = (
  path: string,
  error: z.ZodError,
): readonly ConfigurationProblem[] =>
  error.issues.map((issue) =>
    ConfigurationProblem.of({
      path,
      at: FieldPath.of(issue.path),
      reason: issue.message,
    }),
  );
