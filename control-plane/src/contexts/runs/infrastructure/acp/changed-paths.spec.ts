import { ChangedPaths } from '@runs/infrastructure/acp/changed-paths';
import { describe, expect, it } from 'vitest';

const sent = (update: Record<string, unknown>): string =>
  Buffer.from(JSON.stringify({ sessionId: 'session_1', update })).toString(
    'base64',
  );

const called = (toolCallId: string) =>
  sent({ sessionUpdate: 'tool_call', toolCallId, title: 'Edit' });

const diffed = (toolCallId: string, ...paths: (string | null)[]) =>
  sent({
    sessionUpdate: 'tool_call_update',
    toolCallId,
    status: 'completed',
    rawOutput: 'a long tool output',
    content: [
      { type: 'content', content: { type: 'text', text: 'Edited' } },
      ...paths.map((path) => ({
        type: 'diff',
        ...(path === null ? {} : { path }),
        oldText: 'before',
        newText: 'after',
      })),
    ],
  });

const connected = (protocol: string, attempt = 1) => ({
  type: 'harness.connected',
  message: protocol,
  data: null,
  attempt,
});

type Row = ReturnType<typeof connected> | string;

const read = (...rows: Row[]) => {
  const changed = new ChangedPaths();
  for (const each of rows) {
    changed.take(
      typeof each === 'string'
        ? { type: 'output', message: null, data: each, attempt: 1 }
        : each,
    );
  }
  return changed.paths();
};

describe('ChangedPaths', () => {
  it('names the file each tool call changed, in the order the calls were made', () => {
    expect(
      read(
        called('call_1'),
        called('call_2'),
        diffed('call_2', '/runs/run_1/api/src/retry.ts'),
        diffed('call_1', '/runs/run_1/api/src/uploads.ts'),
      ),
    ).toEqual([
      '/runs/run_1/api/src/uploads.ts',
      '/runs/run_1/api/src/retry.ts',
    ]);
  });

  it('keeps the file a call last changed, the first of its diffs', () => {
    expect(
      read(
        called('call_1'),
        diffed('call_1', '/runs/run_1/api/src/draft.ts'),
        diffed(
          'call_1',
          '/runs/run_1/api/src/uploads.ts',
          '/runs/run_1/api/x.ts',
        ),
        sent({ sessionUpdate: 'tool_call_update', toolCallId: 'call_1' }),
      ),
    ).toEqual(['/runs/run_1/api/src/uploads.ts']);
  });

  it('names nothing for a diff without a path', () => {
    expect(
      read(
        called('call_1'),
        diffed('call_1', '/runs/run_1/api/src/uploads.ts'),
        diffed('call_1', null),
      ),
    ).toEqual([]);
  });

  it('reads the frames of an ACP v1 connection', () => {
    expect(
      read(
        connected('acp/1'),
        called('call_1'),
        diffed('call_1', '/runs/run_1/api/src/uploads.ts'),
      ),
    ).toEqual(['/runs/run_1/api/src/uploads.ts']);
  });

  it('reads no frames of a protocol it does not know', () => {
    expect(
      read(
        connected('acp/9'),
        called('call_1'),
        diffed('call_1', '/runs/run_1/api/src/uploads.ts'),
      ),
    ).toEqual([]);
  });

  it('reads each attempt with the protocol of its own connection', () => {
    const changed = new ChangedPaths();
    changed.take(connected('acp/9', 1));
    changed.take({
      type: 'output',
      message: null,
      data: called('call_1'),
      attempt: 1,
    });
    changed.take({
      type: 'output',
      message: null,
      data: diffed('call_1', '/runs/run_1/api/src/lost.ts'),
      attempt: 1,
    });
    changed.take({
      type: 'output',
      message: null,
      data: called('call_2'),
      attempt: 2,
    });
    changed.take({
      type: 'output',
      message: null,
      data: diffed('call_2', '/runs/run_1/api/src/kept.ts'),
      attempt: 2,
    });

    expect(changed.paths()).toEqual(['/runs/run_1/api/src/kept.ts']);
  });

  it('passes over updates to calls it never saw made, and what it cannot read', () => {
    expect(
      read(
        diffed('call_1', '/runs/run_1/api/src/uploads.ts'),
        sent({
          sessionUpdate: 'tool_call',
          toolCallId: 'call_2',
          content: [{ type: 'diff', path: '/runs/run_1/api/src/early.ts' }],
        }),
        Buffer.from('not json').toString('base64'),
        sent({
          sessionUpdate: 'agent_message_chunk',
          content: { text: 'Done' },
        }),
      ),
    ).toEqual([]);
  });
});
