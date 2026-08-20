import { GetGreetingHandler } from '@application/queries/handlers/get-greeting.handler';
import { describe, expect, it } from 'vitest';

describe('GetGreetingHandler', () => {
  it('returns a greeting for the world', async () => {
    const handler = new GetGreetingHandler();

    await expect(handler.execute()).resolves.toEqual({
      message: 'Hello World!',
    });
  });
});
