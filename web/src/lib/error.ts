import { fieldOf } from '@/lib/record';

export function messageOf(
  thrown: unknown,
  fallback = 'Sorry, the request failed.',
): string {
  if (typeof thrown === 'string') {
    return thrown;
  }

  if (typeof thrown === 'object' && thrown !== null && 'message' in thrown) {
    const body = thrown.message;

    if (typeof body === 'string' && body.length > 0) {
      return body;
    }
    if (Array.isArray(body) && typeof body[0] === 'string') {
      return body[0];
    }
  }

  if (typeof thrown === 'object' && thrown !== null && 'detail' in thrown) {
    const detail = thrown.detail;

    if (typeof detail === 'string' && detail.length > 0) {
      return detail;
    }
  }

  return fallback;
}

export class FieldRefusal extends Error {
  readonly field: string;

  constructor(message: string, field: string) {
    super(message);
    this.name = 'FieldRefusal';
    this.field = field;
  }
}

type Reason = { readonly field: string; readonly message: string };

const reasonOf = (error: unknown): Reason | null => {
  const field = fieldOf(error, 'path');
  const message = fieldOf(error, 'message');

  return typeof field === 'string' &&
    typeof message === 'string' &&
    message.length > 0
    ? { field, message }
    : null;
};

export function refusalOf(
  thrown: unknown,
  fields: readonly string[],
  fallback?: string,
): Error {
  const errors = fieldOf(thrown, 'errors');
  const reasons = (Array.isArray(errors) ? errors : [])
    .filter((error) => fieldOf(error, 'severity') !== 'warning')
    .map(reasonOf);
  const [first] = reasons;

  if (
    first &&
    fields.includes(first.field) &&
    reasons.every((reason) => reason?.field === first.field)
  ) {
    return new FieldRefusal(
      reasons.map((reason) => reason?.message).join(' '),
      first.field,
    );
  }

  return new Error(messageOf(thrown, fallback));
}

const answered = (thrown: unknown, status: number): boolean => {
  return (
    fieldOf(thrown, 'statusCode') === status ||
    fieldOf(thrown, 'status') === status
  );
};

export const notFound = (thrown: unknown): boolean => answered(thrown, 404);
