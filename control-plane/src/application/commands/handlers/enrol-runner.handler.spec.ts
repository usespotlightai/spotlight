import { EnrolRunnerHandler } from '@application/commands/handlers/enrol-runner.handler';
import type { EnrolRunnerCommand } from '@application/commands/runner.commands';
import type { IdGeneratorPort } from '@application/ports/id-generator.port';
import type { RunnerTokenPort } from '@application/ports/runner-token.port';
import type { Runner } from '@domain/aggregates/runner.aggregate';
import type { RunnerRepository } from '@domain/repositories/runner.repository';
import { describe, expect, it, vi } from 'vitest';

const enrolling = () => {
  const add = vi.fn(async (_: Runner) => {});

  const handler = new EnrolRunnerHandler(
    { add } as unknown as RunnerRepository,
    {
      generate: () => '123e4567-e89b-42d3-a456-426614174000',
    } as IdGeneratorPort,
    {
      mint: () => ({ token: 'tok', hash: 'a'.repeat(64) }),
    } as unknown as RunnerTokenPort,
  );

  return { handler, add };
};

const enrol = { name: 'runner-1' } as EnrolRunnerCommand;

describe('EnrolRunnerHandler', () => {
  it('hands back the token the runner is to use', async () => {
    const { handler } = enrolling();

    await expect(handler.execute(enrol)).resolves.toMatchObject({
      name: 'runner-1',
      token: 'tok',
    });
  });

  // The token is shown once and never again, so it is not what was written.
  it('keeps only the hash of it', async () => {
    const { handler, add } = enrolling();

    await handler.execute(enrol);

    expect(add.mock.calls[0]?.[0]).toMatchObject({
      tokenHash: { value: 'a'.repeat(64) },
    });
  });
});
