import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { AuthorizeRunnerCommand } from '@work/application/commands/egress.commands';
import { AuthorizeRunnerHandler } from '@work/application/commands/handlers/authorize-runner.handler';
import {
  NOW,
  runOf,
  SHARED_TOKEN,
  sharedEgress,
} from '@work/application/commands/handlers/egress-handlers.fake-spec';
import { describe, expect, it } from 'vitest';

const handler = new AuthorizeRunnerHandler(
  sharedEgress(Object.fromEntries([runOf('waiting', 'run_1', null)])),
  { hosts: () => ['storage.example.com'] },
  { now: () => NOW } as ClockPort,
  'app.example.com',
  443,
);

describe('AuthorizeRunnerHandler', () => {
  it('authorizes the runner of a proxy credential, with the hosts that every sandbox may connect to', async () => {
    await expect(
      handler.execute(new AuthorizeRunnerCommand(SHARED_TOKEN, 'waiting')),
    ).resolves.toEqual({
      outcome: 'authorized',
      runnerId: 'runner_run_1',
      workspaceId: 'ws_1',
      controlPlaneHost: 'app.example.com',
      controlPlanePort: 443,
      extraAllowedHosts: ['storage.example.com'],
    });
  });

  it('rejects an unknown egress token or proxy credential', async () => {
    for (const [token, credential] of [
      ['other', 'waiting'],
      [SHARED_TOKEN, 'unknown'],
    ]) {
      await expect(
        handler.execute(new AuthorizeRunnerCommand(token, credential)),
      ).resolves.toEqual({ outcome: 'unauthorized' });
    }
  });
});
