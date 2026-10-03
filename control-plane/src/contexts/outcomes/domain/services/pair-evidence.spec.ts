import { PairEvidence } from '@outcomes/domain/services/pair-evidence';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { describe, expect, it } from 'vitest';

const hunk = (id: string, line: string) => ({
  id,
  path: 'api/q.ts',
  header: '@@ -1 +1 @@',
  lines: [line],
});

const RUN = RunId.of('replay_1');

const AGAINST = RunId.of('replay_2');

const evidence = (order: 'run-first' | 'against-first') =>
  PairEvidence.of({
    run: { run: RUN, hunks: [hunk('api/q.ts#1', '+drainFast()')] },
    against: { run: AGAINST, hunks: [hunk('api/q.ts#1', '+drain()')] },
    order,
    title: 'Drain the queue',
    description: null,
    reference: [hunk('api/q.ts#1', '+drainInOrder()')],
  });

describe('PairEvidence', () => {
  it('labels the two changes A and B in the order drawn, beside the accepted change', () => {
    const first = evidence('run-first');
    const second = evidence('against-first');

    expect(first.a.hunks[0]?.id).toBe('A:api/q.ts#1');
    expect(first.a.hunks[0]?.lines).toEqual(['+drainFast()']);
    expect(second.a.hunks[0]?.lines).toEqual(['+drain()']);
    expect(first.reference?.hunks[0]?.id).toBe('reference:api/q.ts#1');
    expect(first.isFor(RUN, AGAINST)).toBe(true);
  });

  it('grounds a reason on the hunks of either change, naming each by its own run', () => {
    const [reason] = evidence('against-first').groundedReasons([
      { text: 'B drains fast.', hunks: ['B:api/q.ts#1', 'A:api/q.ts#1'] },
    ]);

    expect(reason?.runHunks).toEqual(['api/q.ts#1']);
    expect(reason?.againstHunks).toEqual(['api/q.ts#1']);
  });

  it('drops a reason resting on the accepted change or on nothing shown', () => {
    expect(
      evidence('run-first').groundedReasons([
        { text: 'Like the reference.', hunks: ['reference:api/q.ts#1'] },
        { text: 'Somewhere.', hunks: ['A:api/q.ts#9'] },
        { text: 'Nowhere.', hunks: [] },
      ]),
    ).toEqual([]);
  });

  it('has nothing to compare without both changes and the accepted one', () => {
    expect(
      PairEvidence.of({
        run: { run: RUN, hunks: [] },
        against: { run: AGAINST, hunks: [hunk('api/q.ts#1', '+drain()')] },
        order: 'run-first',
        title: 'Drain',
        description: null,
        reference: [hunk('api/q.ts#1', '+drainInOrder()')],
      }).isEmpty,
    ).toBe(true);
    expect(
      PairEvidence.of({
        run: { run: RUN, hunks: [hunk('api/q.ts#1', '+drainFast()')] },
        against: { run: AGAINST, hunks: [hunk('api/q.ts#1', '+drain()')] },
        order: 'run-first',
        title: 'Drain',
        description: null,
        reference: [],
      }).isEmpty,
    ).toBe(true);
  });
});
