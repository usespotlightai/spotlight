import { describe, expect, it } from 'vitest';

import { heldUntilGivenBack, moveOnTargets } from '@/lib/takeover';
import { station } from '@/mocks/world/stations';

const review = station({
  id: 'review',
  key: 'review',
  name: 'Review',
  position: 2,
  harness: 'claude-code',
});
const humans = station({
  id: 'humans',
  key: 'humans',
  name: 'Humans',
  position: 3,
});
const build = station({
  id: 'build',
  key: 'build',
  name: 'Build',
  position: 1,
  harness: 'claude-code',
  passesTo: ['review', 'humans'],
});

describe('moveOnTargets', () => {
  it('moves on only to stations an agent works', () => {
    expect(
      moveOnTargets([build, review, humans], build).map((each) => each.id),
    ).toEqual(['review']);
  });
});

describe('heldUntilGivenBack', () => {
  const takeover = {
    by: { id: 'user_2', name: 'Maya Chen', image: null },
    verdict: 'not-right' as const,
    startedAt: '2026-11-16T09:00:00.000Z',
    runId: null,
    heldMoveTo: null,
  };

  it('names who has the task, and speaks to the taker as you', () => {
    expect(heldUntilGivenBack(takeover, 'user_1')).toBe(
      'Maya Chen has this task until they give it back.',
    );
    expect(heldUntilGivenBack(takeover, 'user_2')).toBe(
      'You have this task until you give it back.',
    );
  });
});
