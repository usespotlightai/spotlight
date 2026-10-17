import { RegisterRunnerHandler } from '@runners/application/commands/handlers/register-runner.handler';
import { RegisterRunnerCommand } from '@runners/application/commands/runner-fleet.commands';
import type { Runner } from '@runners/domain/aggregates/runner.aggregate';
import { aRunner } from '@runners/domain/aggregates/runner-pool.fake-spec';
import { RunnerVersionConflictError } from '@runners/domain/exceptions/runner-version-conflict.error';
import type { RunnerRepository } from '@runners/domain/repositories/runner.repository';
import { RunnerWork } from '@runners/domain/value-objects/runner-work.vo';
import { ApplicationError } from '@shared-kernel/application/errors/application-error';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { describe, expect, it, vi } from 'vitest';

const ID = '123e4567-e89b-42d3-a456-426614174000';
const NOW = new Date('2026-09-24T10:00:30.000Z');

const registering = (
  given: {
    runner?: () => Runner | null;
    save?: (runner: Runner) => Promise<void>;
  } = {},
) => {
  const save = vi.fn(given.save ?? (async (_: Runner) => {}));
  const find = vi.fn(async () =>
    given.runner ? given.runner() : aRunner({ id: ID }),
  );

  const handler = new RegisterRunnerHandler(
    { find, save } as unknown as RunnerRepository,
    { now: () => NOW } as ClockPort,
  );

  return { handler, save, find };
};

const register = new RegisterRunnerCommand(ID, [
  { id: 'claude-code', models: ['claude-sonnet-5'], version: '2.1.0' },
]);

describe('RegisterRunnerHandler', () => {
  it('registers the runner with what it found installed, answering its id', async () => {
    const { handler, save } = registering();

    await expect(handler.execute(register)).resolves.toEqual({ runnerId: ID });

    const saved = save.mock.calls[0]?.[0] as Runner;

    expect(saved.harnesses.map((each) => each.value)).toEqual(['claude-code']);
    expect(saved.terms.values).toEqual(['linux']);
    expect(saved.installed[0]?.version?.value).toBe('2.1.0');
  });

  it('marks the runner as having reached us', async () => {
    const { handler, save } = registering();

    await handler.execute(register);

    expect(save.mock.calls[0]?.[0]).toMatchObject({ lastSeenAt: NOW });
  });

  it('records the models each harness reported', async () => {
    const { handler, save } = registering();

    await handler.execute(register);

    const saved = save.mock.calls[0]?.[0] as Runner;

    expect(saved.installed[0]?.models.map((each) => each.value)).toEqual([
      'claude-sonnet-5',
    ]);
  });

  it('rejects a runner nobody started', async () => {
    const { handler } = registering({ runner: () => null });

    await expect(handler.execute(register)).rejects.toMatchObject({
      kind: 'not-found',
    });
  });

  it('rejects a runner that has ended', async () => {
    const { handler, save } = registering({
      runner: () =>
        aRunner({ id: ID }).took(RunnerWork.run('run_1'), NOW).ended(NOW),
    });

    await expect(handler.execute(register)).rejects.toThrow(ApplicationError);
    expect(save).not.toHaveBeenCalled();
  });

  it('reads the runner again when a heartbeat wrote it first', async () => {
    let raced = false;
    const { handler, save, find } = registering({
      save: async () => {
        if (!raced) {
          raced = true;
          throw new RunnerVersionConflictError(ID);
        }
      },
    });

    await handler.execute(register);

    expect(find).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenCalledTimes(2);
  });
});
