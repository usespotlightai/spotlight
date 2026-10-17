import type { Bindings } from '@platform/expressions/bindings';
import {
  ExpressionFailedError,
  firstLine,
} from '@platform/expressions/expression.errors';
import type { Expression } from '@platform/expressions/expression-engine.port';

export const isTrue = (expression: Expression, against: Bindings): boolean => {
  try {
    return expression.evaluate(against) === true;
  } catch {
    return false;
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
  against: Bindings,
): string | null => {
  try {
    return asText(expression.evaluate(against));
  } catch {
    return null;
  }
};

export const value = (expression: Expression, against: Bindings): unknown => {
  try {
    const read = expression.evaluate(against);

    return read === undefined ? null : read;
  } catch {
    return null;
  }
};

export const required = (
  expression: Expression,
  against: Bindings,
): unknown => {
  try {
    const read = expression.evaluate(against);

    return read === undefined ? null : read;
  } catch (error) {
    throw new ExpressionFailedError(
      expression.at,
      expression.source,
      firstLine(error, 'could not be read'),
    );
  }
};

export const requiredText = (
  expression: Expression,
  against: Bindings,
): string | null => asText(required(expression, against));
