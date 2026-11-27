import { fieldOf } from '@platform/json/field-of';

// Why an outbound call got no answer, with its cause, such as ECONNREFUSED.
const causeOf = (cause: Error): string => {
  const code = fieldOf(cause, 'code');

  if (cause.message !== '') {
    return cause.message;
  }

  return typeof code === 'string' && code !== '' ? code : cause.name;
};

export const failureOf = (error: unknown): string => {
  const cause = fieldOf(error, 'cause');

  return error instanceof Error
    ? cause instanceof Error
      ? `${error.message}: ${causeOf(cause)}`
      : error.message
    : String(error);
};
