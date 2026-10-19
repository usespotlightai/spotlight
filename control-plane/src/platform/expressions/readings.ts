import diagnostics from 'node:diagnostics_channel';
import type { CelVariables } from '@platform/expressions/cel-variables';
import {
  ExpressionFailedError,
  firstLine,
} from '@platform/expressions/expression.errors';
import type { Expression } from '@platform/expressions/expression-engine.port';

export const EXPRESSION_FAILED = 'spotlight:expression:failed';

export interface ExpressionFailure {
  readonly location: string | null;
  readonly error: string;
}

const failed = diagnostics.channel(EXPRESSION_FAILED);

// A message can hold the values the expression read. The code cannot.
const codeOf = (error: unknown): string => {
  const code = (error as { code?: unknown } | null)?.code;

  if (typeof code === 'string') {
    return code;
  }

  return error instanceof Error ? error.name : 'unknown';
};

const readAs = <T>(expression: Expression, error: unknown, fallback: T): T => {
  if (failed.hasSubscribers) {
    failed.publish({
      location: expression.location,
      error: codeOf(error),
    } satisfies ExpressionFailure);
  }

  return fallback;
};

export const isTrue = (
  expression: Expression,
  against: CelVariables,
): boolean => {
  try {
    return expression.evaluate(against) === true;
  } catch (error) {
    return readAs(expression, error, false);
  }
};

const asText = (read: unknown): string | null => {
  if (read === null || read === undefined || read === '') {
    return null;
  }

  return typeof read === 'object' ? null : String(read);
};

export const evaluateText = (
  expression: Expression,
  against: CelVariables,
): string | null => {
  try {
    return asText(expression.evaluate(against));
  } catch (error) {
    return readAs(expression, error, null);
  }
};

export const value = (
  expression: Expression,
  against: CelVariables,
): unknown => {
  try {
    const read = expression.evaluate(against);

    return read === undefined ? null : read;
  } catch (error) {
    return readAs(expression, error, null);
  }
};

export const required = (
  expression: Expression,
  against: CelVariables,
): unknown => {
  try {
    const read = expression.evaluate(against);

    return read === undefined ? null : read;
  } catch (error) {
    throw new ExpressionFailedError(
      expression.location,
      expression.source,
      firstLine(error, 'could not be read'),
    );
  }
};

export const requiredText = (
  expression: Expression,
  against: CelVariables,
): string | null => asText(required(expression, against));
