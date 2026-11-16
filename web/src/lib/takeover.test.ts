import { describe, expect, it, vi } from 'vitest';

import {
  handBackAction,
  handBackNotePrompt,
  handBackChoices,
  handedBackTo,
  heldUntilHandedBack,
  moveOnTargets,
} from '@/lib/takeover';
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

describe('heldUntilHandedBack', () => {
  const takeover = {
    by: { id: 'user_2', name: 'Maya Chen', image: null },
    verdict: 'not-right' as const,
    startedAt: '2026-11-16T09:00:00.000Z',
    runId: null,
    heldMoveTo: null,
  };

  it('names who has the task and since when, and speaks to the taker as you', () => {
    vi.setSystemTime(new Date('2026-11-16T09:12:00.000Z'));

    expect(heldUntilHandedBack(takeover, 'user_1')).toBe(
      'Maya Chen took over 12m ago. They have this task until they hand it back.',
    );
    expect(heldUntilHandedBack(takeover, 'user_2')).toBe(
      'You took over 12m ago. You have this task until you hand it back.',
    );

    vi.useRealTimers();
  });
});

const completed = station({
  id: 'completed',
  key: 'completed',
  name: 'Completed',
  position: 4,
  kind: 'completed',
});

describe('handBackChoices', () => {
  it('names the station to move on to when there is only one', () => {
    expect(
      handBackChoices(build, [review], null).map((each) => each.label),
    ).toEqual([
      'Hand it back to Build',
      'Move it on to Review',
      'Finish the task',
    ]);
  });

  it('offers finishing once when an event already asked to finish the task', () => {
    expect(
      handBackChoices(build, [], completed).map((each) => each.label),
    ).toEqual(['Hand it back to the line']);
  });
});

describe('handedBackTo', () => {
  it('says what the line does next', () => {
    expect(handedBackTo('continue', build, undefined, null)).toBe(
      'Build runs again with your changes.',
    );
    expect(handedBackTo('move-on', build, review, null)).toBe(
      'The task moved to Review.',
    );
    expect(handedBackTo('finish', build, undefined, null)).toBe(
      'The task is completed.',
    );
    expect(handedBackTo('continue', build, undefined, completed)).toBe(
      'The task is completed.',
    );
  });
});

describe('handBackAction', () => {
  it('names the outcome on the button', () => {
    expect(handBackAction('continue')).toBe('Hand it back');
    expect(handBackAction('move-on')).toBe('Move it on');
    expect(handBackAction('finish')).toBe('Finish the task');
  });
});

describe('handBackNotePrompt', () => {
  it('asks for the note the next reader needs', () => {
    expect(handBackNotePrompt('continue', build, undefined, null)).toBe(
      'What should Build do next? (optional)',
    );
    expect(handBackNotePrompt('move-on', build, review, null)).toBe(
      'What should Review know? (optional)',
    );
    expect(handBackNotePrompt('finish', build, undefined, null)).toBe(
      'Note for your team (optional)',
    );
    expect(handBackNotePrompt('continue', build, undefined, completed)).toBe(
      'Note for your team (optional)',
    );
  });
});
