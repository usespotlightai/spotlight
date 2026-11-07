import { answersTransiently } from '@integrations/domain/services/call-transience';
import { describe, expect, it } from 'vitest';

describe('answersTransiently', () => {
  it('retries throttling and server errors only', () => {
    expect([408, 425, 429, 500, 503].map(answersTransiently)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
    expect([400, 401, 403, 404, 422].map(answersTransiently)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
  });
});
