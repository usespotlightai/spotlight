import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import {
  CompleteRunCommand,
  RenewReviewWorkLeaseCommand,
} from '@runs/application/commands/runner.commands';
import { RunnerController } from '@runs/presentation/http/controllers/runner.controller';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { describe, expect, it } from 'vitest';

describe('RunnerController, taking a run’s completion', () => {
  it('passes on that its host stopped the run for running past its time', async () => {
    const sent: unknown[] = [];
    const controller = new RunnerController(
      partial<CommandBus>({
        execute: (command: unknown) => {
          sent.push(command);
          return Promise.resolve({ waiting: false });
        },
      }),
      partial<QueryBus>({}),
    );

    await controller.complete('run_1', 'runner_1', {
      exitCode: -1,
      failed: true,
      timedOut: true,
      message: "Sandbox stopped at the host's time limit. Time limit: 2h0m0s",
    });

    expect(sent[0]).toBeInstanceOf(CompleteRunCommand);
    expect(sent[0]).toMatchObject({
      runId: 'run_1',
      runnerId: 'runner_1',
      failed: true,
      setupFailed: false,
      timedOut: true,
    });
  });
});

describe('RunnerController, renewing the lease on check work', () => {
  const renewing = (answer: 'renewed' | 'stop') => {
    const sent: unknown[] = [];
    const controller = new RunnerController(
      partial<CommandBus>({
        execute: (command: unknown) => {
          sent.push(command);
          return Promise.resolve(answer);
        },
      }),
      partial<QueryBus>({}),
    );

    return { controller, sent };
  };

  it('renews a change stack’s check as a check by its stack, saying whether it is a repeat', async () => {
    const { controller, sent } = renewing('renewed');

    await expect(
      controller.renewCheckLease('stack_1', 'true', 'runner_1'),
    ).resolves.toEqual({ stop: false });
    expect(sent).toEqual([
      new RenewReviewWorkLeaseCommand(
        { kind: 'check', stackId: 'stack_1', recheck: true },
        'runner_1',
      ),
    ]);
  });

  it('renews a push diff as a diff by its id, never as a repeat, and passes on a stop', async () => {
    const { controller, sent } = renewing('stop');

    await expect(
      controller.renewPushDiffLease('diff_1', 'runner_1'),
    ).resolves.toEqual({ stop: true });
    expect(sent).toEqual([
      new RenewReviewWorkLeaseCommand(
        { kind: 'diff', diffId: 'diff_1' },
        'runner_1',
      ),
    ]);
  });
});
