import { HARNESS_CONNECTED } from '@runs/domain/value-objects/journal-entry-type';

export interface HarnessEvent {
  readonly type: string;
  readonly data: Record<string, unknown>;
}

export const connected = (): HarnessEvent => ({
  type: HARNESS_CONNECTED,
  data: {
    protocol: 'acp/1',
    events: 1,
    session: 'session_1',
    reports: {
      background: false,
      selfStartedTurns: false,
      turnUsage: true,
      commandOutput: false,
    },
  },
});

export const said = (text: string, id = 'm1'): HarnessEvent => ({
  type: 'message',
  data: { id, role: 'agent', text },
});

export const toolChanged = (call: Record<string, unknown>): HarnessEvent => ({
  type: 'tool.changed',
  data: { title: 'a tool', ...call },
});

export const spent = (amount: number): HarnessEvent => ({
  type: 'context.changed',
  data: { used: 1_000, size: 200_000, cost: { amount, currency: 'USD' } },
});

export const turnEnded = (usage: Record<string, number>): HarnessEvent => ({
  type: 'turn.ended',
  data: { turn: 1, stop: 'ended', usage },
});

export const entryOf = <At>(seq: number, at: At, event: HarnessEvent) => ({
  seq,
  type: event.type,
  at,
  data: Buffer.from(JSON.stringify(event.data)).toString('base64'),
});

export const posted = (...events: HarnessEvent[]) =>
  [connected(), ...events].map((each, index) =>
    entryOf(index + 1, new Date().toISOString(), each),
  );

export const changing = (message: string, line: string) => {
  const edit = { id: 'call_1', title: 'Edit', input: { file: 'queue.js' } };

  return posted(
    said(message),
    toolChanged({ ...edit, status: 'pending' }),
    toolChanged({
      ...edit,
      status: 'completed',
      files: [
        {
          path: '/workspace/api/queue.js',
          operation: 'update',
          before: 'stall()\n',
          after: `${line}\n`,
        },
      ],
    }),
  );
};
