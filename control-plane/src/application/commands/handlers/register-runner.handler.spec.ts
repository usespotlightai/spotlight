import { RegisterRunnerHandler } from '@application/commands/handlers/register-runner.handler';
import type { RegisterRunnerCommand } from '@application/commands/runner.commands';
import { UseCaseFault } from '@application/errors/use-case.fault';
import type { ClockPort } from '@application/ports/clock.port';
import type { RunnerReaderPort } from '@application/ports/runner-reader.port';
import type { TransactionPort } from '@application/ports/transaction.port';
import type { SettleSetup } from '@application/services/settle-setup.service';
import { Runner } from '@domain/aggregates/runner.aggregate';
import type { RunnerRepository } from '@domain/repositories/runner.repository';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { RunnerName } from '@domain/value-objects/runner-name.vo';
import { TokenHash } from '@domain/value-objects/token-hash.vo';
import { describe, expect, it, vi } from 'vitest';

const ID = '123e4567-e89b-42d3-a456-426614174000';
const NOW = new Date('2026-01-02T03:04:05.000Z');

const enrolled = () =>
  Runner.enrol({
    id: RunnerId.of(ID),
    name: RunnerName.of('runner-1'),
    tokenHash: TokenHash.of('a'.repeat(64)),
  });

const registering = (given: { connected?: boolean; known?: boolean } = {}) => {
  const save = vi.fn(async (_: Runner) => {});
  const wherever = vi.fn(async () => {});

  const handler = new RegisterRunnerHandler(
    {
      find: vi.fn(async () => (given.known === false ? null : enrolled())),
      save,
    } as unknown as RunnerRepository,
    { now: () => NOW } as ClockPort,
    { run: (work: () => Promise<unknown>) => work() } as TransactionPort,
    {
      anyConnected: vi.fn(async () => given.connected ?? false),
    } as unknown as RunnerReaderPort,
    { wherever } as unknown as SettleSetup,
  );

  return { handler, save, wherever };
};

const register = {
  runnerId: ID,
  harnesses: ['claude-code'],
} as RegisterRunnerCommand;

describe('RegisterRunnerHandler', () => {
  it('marks the runner as having reached us, with what it can run', async () => {
    const { handler, save } = registering();

    await handler.execute(register);

    expect(save.mock.calls[0]?.[0]).toMatchObject({
      lastSeenAt: NOW,
      harnesses: [{ value: 'claude-code' }],
    });
  });

  it('refuses a token nobody was enrolled against', async () => {
    const { handler } = registering({ known: false });

    await expect(handler.execute(register)).rejects.toThrow(UseCaseFault);
  });

  // Enrolling writes a row and mints a token. This is the moment there is a
  // machine.
  it('looks at every list once something first checks in', async () => {
    const { handler, wherever } = registering();

    await handler.execute(register);

    expect(wherever).toHaveBeenCalled();
  });

  it('looks at nothing where one had already checked in', async () => {
    const { handler, wherever } = registering({ connected: true });

    await handler.execute(register);

    expect(wherever).not.toHaveBeenCalled();
  });
});
