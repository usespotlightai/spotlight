import { replayOf, sinceOf } from '@platform/live/live-replay';
import { describe, expect, it } from 'vitest';

const notice = (sequence: number) => ({
  channel: 'workspace:ws_1' as const,
  topic: 'task' as const,
  ids: {},
  sequence,
});

describe('replayOf', () => {
  it('sends every change after the sequences given', () => {
    expect(
      replayOf(
        ['workspace:ws_1'],
        new Map([['workspace:ws_1', 3]]),
        new Map([
          ['workspace:ws_1', { head: 5, after: [notice(4), notice(5)] }],
        ]),
      ),
    ).toEqual({
      notices: [notice(4), notice(5)],
      heads: { 'workspace:ws_1': 5 },
      complete: true,
    });
  });

  it('is not complete when a channel has no sequence or lost changes', () => {
    expect(
      replayOf(
        ['workspace:ws_1', 'person:user_1'],
        new Map([['workspace:ws_1', 3]]),
        new Map([
          ['workspace:ws_1', { head: 6, after: [notice(5), notice(6)] }],
          ['person:user_1', { head: 2, after: [] }],
        ]),
      ),
    ).toMatchObject({
      heads: { 'workspace:ws_1': 6, 'person:user_1': 2 },
      complete: false,
    });
  });
});

describe('sinceOf', () => {
  it('reads the sequences of watched channels and drops the rest', () => {
    expect(
      sinceOf(
        [
          'workspace:ws_1@12,person:user_1@3',
          'workspace:ws_9@4',
          'workspace:ws_2@-1',
          'workspace:ws_2@x',
          'nonsense',
        ],
        ['workspace:ws_1', 'workspace:ws_2', 'person:user_1'],
      ),
    ).toEqual(
      new Map([
        ['workspace:ws_1', 12],
        ['person:user_1', 3],
      ]),
    );
  });
});
