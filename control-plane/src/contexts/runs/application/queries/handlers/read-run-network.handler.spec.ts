import type { EgressEnforcement } from '@runs/application/contracts/run-journal.contract';
import type { RunConnectionsPort } from '@runs/application/ports/run-connections.port';
import type { RunJournalEntryReaderPort } from '@runs/application/ports/run-journal-entry-reader.port';
import type { RunViewersPort } from '@runs/application/ports/run-viewers.port';
import { ReadRunNetworkHandler } from '@runs/application/queries/handlers/read-run-network.handler';
import { ReadRunNetworkQuery } from '@runs/application/queries/read-run-network.query';
import { RunConnection } from '@runs/domain/value-objects/run-connection.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-10-16T12:00:00.000Z');

const connection = (host: string) =>
  RunConnection.of({
    host,
    port: 443,
    bytesOut: 10,
    bytesIn: 20,
    ms: 5,
    outcome: 'passthrough',
    status: null,
    reason: null,
    at: AT,
  });

const reading = (checked: EgressEnforcement | null, visible = true) => {
  const read: number[] = [];
  const runs = {
    watchedBy: async (runId: RunId) => (visible ? { runId, attempt: 2 } : null),
  } as unknown as RunViewersPort;
  const events = {
    eventsSince: async () => [],
    egressEnforcementOf: async (_runId: RunId, attempt: number) => {
      read.push(attempt);
      return checked;
    },
  } satisfies RunJournalEntryReaderPort;
  const connections = {
    record: async () => {},
    of: async () => [
      { attempt: 1, connection: connection('old.example.com') },
      { attempt: 2, connection: connection('registry.npmjs.org') },
    ],
    errorsIn: async () => [],
    purgeBefore: async () => 0,
  } satisfies RunConnectionsPort;

  return {
    handler: new ReadRunNetworkHandler(runs, events, connections),
    read,
  };
};

describe('ReadRunNetworkHandler', () => {
  it('reads the connections of the current attempt, and egress enforced', async () => {
    const { handler, read } = reading('enforced');

    await expect(
      handler.execute(new ReadRunNetworkQuery('run_1', 'user_1')),
    ).resolves.toEqual({
      runId: 'run_1',
      attempt: 2,
      egressEnforcement: 'enforced',
      connections: [
        {
          host: 'registry.npmjs.org',
          port: 443,
          bytesOut: 10,
          bytesIn: 20,
          ms: 5,
          outcome: 'passthrough',
          status: null,
          reason: null,
          error: null,
          at: AT.toISOString(),
        },
      ],
    });
    expect(read).toEqual([2]);
  });

  it('reads egress not enforced, or no check at all', async () => {
    for (const egressEnforcement of ['not-enforced', null] as const) {
      await expect(
        reading(egressEnforcement).handler.execute(
          new ReadRunNetworkQuery('run_1', 'user_1'),
        ),
      ).resolves.toMatchObject({ egressEnforcement });
    }
  });

  it('reads nothing for a run the viewer may not see', async () => {
    await expect(
      reading(null, false).handler.execute(
        new ReadRunNetworkQuery('run_1', 'user_1'),
      ),
    ).resolves.toBeNull();
  });
});
