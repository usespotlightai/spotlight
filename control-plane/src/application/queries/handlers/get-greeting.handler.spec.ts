import { GetGreetingQuery } from '@application/queries/get-greeting.query';
import { GetGreetingHandler } from '@application/queries/handlers/get-greeting.handler';
import { EmptyRecipientError } from '@domain/exceptions/empty-recipient.error';
import { describe, expect, it } from 'vitest';

describe('GetGreetingHandler', () => {
  it('greets the recipient it is given', async () => {
    const handler = new GetGreetingHandler();

    await expect(
      handler.execute(new GetGreetingQuery('Leon')),
    ).resolves.toEqual({ message: 'Hello Leon!' });
  });

  it('still greets the world when asked to', async () => {
    const handler = new GetGreetingHandler();

    await expect(
      handler.execute(new GetGreetingQuery('World')),
    ).resolves.toEqual({ message: 'Hello World!' });
  });

  it('rejects a blank recipient at the domain boundary', async () => {
    const handler = new GetGreetingHandler();

    await expect(handler.execute(new GetGreetingQuery('  '))).rejects.toThrow(
      EmptyRecipientError,
    );
  });
});
