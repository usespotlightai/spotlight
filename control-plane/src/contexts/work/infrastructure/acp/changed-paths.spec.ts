import { ChangedPaths } from '@work/infrastructure/acp/changed-paths';
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

const read = (...data: string[]) => {
  const changed = new ChangedPaths();
  for (const each of data) {
    changed.take(each);
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
