import { RegisterRunnerHandler } from '@runners/application/commands/handlers/register-runner.handler';
import { RegisterRunnerCommand } from '@runners/application/commands/runner-fleet.commands';
import { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { RunnerMovedOnError } from '@runners/domain/exceptions/runner-moved-on.error';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { RunnerName } from '@runners/domain/value-objects/runner-name.vo';
import { UseCaseFault } from '@shared-kernel/application/errors/use-case.fault';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TokenHash } from '@shared-kernel/domain/value-objects/token-hash.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const ID = '123e4567-e89b-42d3-a456-426614174000';
const NOW = new Date('2026-01-02T03:04:05.000Z');

const enrolled = () =>
  Runner.enrol({
    id: RunnerId.of(ID),
    workspaceId: WorkspaceId.of('ws_1'),
    name: RunnerName.of('runner-1'),
    tokenHash: TokenHash.of('a'.repeat(64)),
  });

const registering = (
  given: { known?: boolean; save?: (runner: Runner) => Promise<void> } = {},
) => {
  const save = vi.fn(given.save ?? (async (_: Runner) => {}));
  const find = vi.fn(async () => (given.known === false ? null : enrolled()));

  const handler = new RegisterRunnerHandler(
    { find, save } as unknown as RunnerRepository,
    { now: () => NOW } as ClockPort,
  );

  return { handler, save, find };
};

const register = new RegisterRunnerCommand(ID, [
  { id: 'claude-code', models: ['claude-sonnet-5'] },
]);

describe('RegisterRunnerHandler', () => {
  it('marks the runner as having reached us, with what it can run', async () => {
    const { handler, save } = registering();

    await handler.execute(register);

    expect(save.mock.calls[0]?.[0]).toMatchObject({
      lastSeenAt: NOW,
      harnesses: [{ value: 'claude-code' }],
    });
  });

  it('records, on the runner, the models each harness reported', async () => {
    const { handler, save } = registering();

    await handler.execute(register);

    const saved = save.mock.calls[0]?.[0] as Runner;

    expect(
      saved.modelsOf(HarnessId.of('claude-code')).map((each) => each.value),
    ).toEqual(['claude-sonnet-5']);
  });

  it('refuses a token nobody was enrolled against', async () => {
    const { handler } = registering({ known: false });

    await expect(handler.execute(register)).rejects.toThrow(UseCaseFault);
  });

  it('says the runner registered, so whatever waits on one can look again', async () => {
    const { handler, save } = registering();

    await handler.execute(register);

    expect(
      save.mock.calls[0]?.[0].pullEvents().map((each) => each.kind),
    ).toContain('runner.registered');
  });

  it('reads the runner again when a heartbeat wrote it first', async () => {
    let raced = false;
    const { handler, save, find } = registering({
      save: async () => {
        if (!raced) {
          raced = true;
          throw new RunnerMovedOnError(ID);
        }
      },
    });

    await handler.execute(register);

    expect(find).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledTimes(2);
  });
});
