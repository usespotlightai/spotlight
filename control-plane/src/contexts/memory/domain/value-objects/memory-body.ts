import { InvalidMemoryError } from '@memory/domain/exceptions/invalid-memory.error';

const MOST_BODY = 1_000;

export const memoryBody = (raw: string): string => {
  const body = raw.trim();

  if (!body || body.length > MOST_BODY) {
    throw new InvalidMemoryError(
      `says what is remembered in at most ${MOST_BODY} characters`,
    );
  }

  return body;
};
