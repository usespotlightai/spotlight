import { ProblemException } from '@platform/http/resources/problem.exception';
import type { Forbidden } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

const REQUEST = 'request';

const refusedAt = (field: readonly string[], reason: string): never => {
  throw ProblemException.invalid(REQUEST, [
    ConfigurationProblem.of({ path: '', at: FieldPath.of(field), reason }),
  ]);
};

const fieldsOf = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};

export const textAt = (body: unknown, field: string, says: string): string => {
  const held = fieldsOf(body)[field];

  return typeof held === 'string' ? held : refusedAt([field], says);
};

export const ceilingIn = (
  body: unknown,
): { readonly amount: number; readonly currency: string } => {
  const ceiling = fieldsOf(fieldsOf(body).ceiling);
  const { amount, currency } = ceiling;

  if (typeof amount !== 'number') {
    return refusedAt(
      ['ceiling', 'amount'],
      'is the most the replay may spend, as a number',
    );
  }

  return {
    amount,
    currency:
      typeof currency === 'string'
        ? currency
        : refusedAt(
            ['ceiling', 'currency'],
            'is the currency it is counted in, as in USD',
          ),
  };
};

export const keyedIn = (
  line: string | undefined,
  station: string | undefined,
): { readonly lineId: string; readonly key: string } | null => {
  if (line === undefined && station === undefined) {
    return null;
  }

  return line && station
    ? { lineId: line, key: station }
    : refusedAt(
        [line ? 'station' : 'line'],
        'names a station together with its line',
      );
};

const isForbidden = <T>(outcome: T | Forbidden): outcome is Forbidden =>
  (outcome as { readonly outcome?: unknown }).outcome === 'forbidden';

export const allowed = <T>(kind: string, outcome: T | Forbidden): T => {
  if (isForbidden(outcome)) {
    throw ProblemException.forbidden(kind, outcome.act);
  }

  return outcome;
};
