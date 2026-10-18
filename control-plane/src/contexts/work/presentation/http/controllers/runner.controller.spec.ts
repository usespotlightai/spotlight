import type { CommandBus, QueryBus } from '@nestjs/cqrs';
import { CompleteRunCommand } from '@work/application/commands/runner.commands';
import { RunnerController } from '@work/presentation/http/controllers/runner.controller';
import { describe, expect, it } from 'vitest';

describe('RunnerController, taking a run’s completion', () => {
  it('passes on that its host stopped the run for running past its time', async () => {
    const sent: unknown[] = [];
    const controller = new RunnerController(
      {
        execute: async (command: unknown) => {
          sent.push(command);
          return { waiting: false };
        },
      } as unknown as CommandBus,
      {} as QueryBus,
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
