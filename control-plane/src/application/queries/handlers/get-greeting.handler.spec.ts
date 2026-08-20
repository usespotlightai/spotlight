import { GetGreetingHandler } from '@application/queries/handlers/get-greeting.handler';

describe('GetGreetingHandler', () => {
  it('returns a greeting for the world', async () => {
    const handler = new GetGreetingHandler();

    await expect(handler.execute()).resolves.toEqual({
      message: 'Hello World!',
    });
  });
});
