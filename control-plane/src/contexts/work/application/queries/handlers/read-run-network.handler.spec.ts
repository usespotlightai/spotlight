import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { EGRESS_CHECKED } from '@work/application/contracts/run-journal.contract';
import type { RunConnectionsPort } from '@work/application/ports/run-connections.port';
import type { RunEventReaderPort } from '@work/application/ports/run-event-reader.port';
import { ReadRunNetworkHandler } from '@work/application/queries/handlers/read-run-network.handler';
import { ReadRunNetworkQuery } from '@work/application/queries/read-run-network.query';
import { RunConnection } from '@work/domain/value-objects/run-connection.vo';
import { describe, expect, it } from 'vitest';

const AT = new Date('2026-10-16T12:00:00.000Z');

const told = (data: unknown) =>
  Buffer.from(JSON.stringify(data)).toString('base64');

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

const reading = (checked: string | null, visible = true) => {
  const asked: string[] = [];
  const events = {
    findForViewer: async (runId: RunId) =>
      visible ? { id: runId.value, attempt: 2 } : null,
    eventsSince: async () => [],
    lastOfType: async (_runId: RunId, _attempt: number, type: string) => {
      asked.push(type);
      return checked === null
        ? null
        : { attempt: 2, seq: 3, type, at: AT.toISOString(), data: checked };
    },
  } satisfies RunEventReaderPort;
  const connections = {
    record: async () => {},
    of: async () => [
      { attempt: 1, connection: connection('old.example.com') },
      { attempt: 2, connection: connection('registry.npmjs.org') },
    ],
    errorsIn: async () => [],
    forgetBefore: async () => 0,
  } satisfies RunConnectionsPort;

  return {
    handler: new ReadRunNetworkHandler(events, connections),
    asked,
  };
};

describe('ReadRunNetworkHandler', () => {
  it('reads the connections of the current attempt, and egress enforced', async () => {
    const { handler, asked } = reading(told({ enforced: true }));

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
    expect(asked).toEqual([EGRESS_CHECKED]);
  });

  it('reads egress not enforced, or no check at all', async () => {
    for (const [checked, egressEnforcement] of [
      [told({ enforced: false }), 'not-enforced'],
      [null, null],
      [told({ enforced: 'yes' }), null],
      ['not base64 json', null],
    ] as const) {
      await expect(
        reading(checked).handler.execute(
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
