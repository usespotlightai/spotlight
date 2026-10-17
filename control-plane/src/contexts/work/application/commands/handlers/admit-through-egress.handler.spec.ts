import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { AdmitThroughEgressCommand } from '@work/application/commands/egress.commands';
import { AdmitThroughEgressHandler } from '@work/application/commands/handlers/admit-through-egress.handler';
import {
  NOW,
  runOf,
  SHARED_TOKEN,
  sharedEgress,
} from '@work/application/commands/handlers/egress-handlers.fake-spec';
import { describe, expect, it } from 'vitest';

const handler = new AdmitThroughEgressHandler(
  sharedEgress(Object.fromEntries([runOf('waiting', 'run_1', null)])),
  { hosts: () => ['storage.example.com'] },
  { now: () => NOW } as ClockPort,
  'app.example.com',
  443,
);

describe('AdmitThroughEgressHandler', () => {
  it('admits the runner of a proxy credential, with what every sandbox reaches', async () => {
    await expect(
      handler.execute(new AdmitThroughEgressCommand(SHARED_TOKEN, 'waiting')),
    ).resolves.toEqual({
      outcome: 'admitted',
      runnerId: 'runner_run_1',
      workspaceId: 'ws_1',
      controlPlaneHost: 'app.example.com',
      controlPlanePort: 443,
      reaches: ['storage.example.com'],
    });
  });

  it('refuses an unknown egress token or proxy credential', async () => {
    for (const [token, credential] of [
      ['other', 'waiting'],
      [SHARED_TOKEN, 'unknown'],
    ]) {
      await expect(
        handler.execute(new AdmitThroughEgressCommand(token, credential)),
      ).resolves.toEqual({ outcome: 'refused' });
    }
  });
});
