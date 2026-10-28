import { ProblemException } from '@platform/http/resources/problem.exception';
import type { Forbidden } from '@shared-kernel/application/dto/resource-outcomes.dto';
import { ConfigurationProblem } from '@shared-kernel/domain/value-objects/configuration-problem.vo';
import { FieldPath } from '@shared-kernel/domain/value-objects/field-path.vo';

const REQUEST = 'request';

const rejectAt = (field: readonly string[], reason: string): never => {
  throw ProblemException.invalid(REQUEST, [
    ConfigurationProblem.of({ path: '', at: FieldPath.of(field), reason }),
  ]);
};

const fieldsOf = (body: unknown): Record<string, unknown> =>
  typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};

export const textAt = (
  body: unknown,
  field: string,
  reason: string,
): string => {
  const value = fieldsOf(body)[field];

  return typeof value === 'string' ? value : rejectAt([field], reason);
};

const ceilingAt = (
  raw: unknown,
  at: readonly string[],
  what: string,
): { readonly amount: number; readonly currency: string } => {
  const { amount, currency } = fieldsOf(raw);

  if (typeof amount !== 'number') {
    return rejectAt(
      [...at, 'amount'],
      `Ceiling amount must be a number. It is the most the ${what} may spend.`,
    );
  }

  return {
    amount,
    currency:
      typeof currency === 'string'
        ? currency
        : rejectAt(
            [...at, 'currency'],
            'Ceiling currency must be a currency code, such as USD.',
          ),
  };
};

export const ceilingIn = (
  body: unknown,
): { readonly amount: number; readonly currency: string } =>
  ceilingAt(fieldsOf(body).ceiling, ['ceiling'], 'replay');

const countAt = (
  fields: Record<string, unknown>,
  at: readonly string[],
  reason: string,
): number => {
  const count = fields[at[at.length - 1] as string];

  return typeof count === 'number' ? count : rejectAt(at, reason);
};

const optionalTextAt = (
  fields: Record<string, unknown>,
  at: readonly string[],
  reason: string,
): string | null => {
  const text = fields[at[at.length - 1] as string];

  if (text === undefined || text === null) {
    return null;
  }

  return typeof text === 'string' ? text : rejectAt(at, reason);
};

export const repeatsIn = (body: unknown): number => {
  const fields = fieldsOf(body);
  const repeats = fields.repeats;

  return repeats === undefined || repeats === null
    ? 1
    : countAt(fields, ['repeats'], 'Repeats must be a number.');
};

export const referenceIn = (
  body: unknown,
): {
  readonly commit: string | null;
  readonly pullRequest: number | null;
} => {
  const reference = fieldsOf(fieldsOf(body).reference);
  const pullRequest = reference.pullRequest;

  return {
    commit: optionalTextAt(
      reference,
      ['reference', 'commit'],
      'Commit must be a hex SHA or left out.',
    ),
    pullRequest:
      pullRequest === undefined || pullRequest === null
        ? null
        : countAt(
            reference,
            ['reference', 'pullRequest'],
            'Pull request must be a number or left out.',
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
    : rejectAt(
        [line ? 'station' : 'line'],
        'Line and station must be sent together.',
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
