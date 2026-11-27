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

const reasonFor = (
  error: unknown,
  fields: readonly string[],
): string | null => {
  const path = fieldOf(error, 'path');
  const message = fieldOf(error, 'message');

  return typeof path === 'string' &&
    fields.includes(path) &&
    typeof message === 'string' &&
    message.length > 0
    ? message
    : null;
};

// What Spotlight found wrong, for a form that shows it beside the fields it names: their reasons without the field names. A problem with any other field keeps its detail, which names each field.
export function refusalOf(
  thrown: unknown,
  fields: readonly string[],
  fallback?: string,
): string {
  const errors = fieldOf(thrown, 'errors');

  if (Array.isArray(errors) && errors.length > 0) {
    const reasons = errors.map((error) => reasonFor(error, fields));

    if (reasons.every((reason) => reason !== null)) {
      return reasons.join(' ');
    }
  }

  return messageOf(thrown, fallback);
}

const answered = (thrown: unknown, status: number): boolean => {
  return (
    fieldOf(thrown, 'statusCode') === status ||
    fieldOf(thrown, 'status') === status
  );
};

export const notFound = (thrown: unknown): boolean => answered(thrown, 404);
