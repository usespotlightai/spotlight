import { describe, expect, it, vi } from 'vitest';

import {
  resumeAction,
  resumeNotePrompt,
  resumeChoices,
  resumedTo,
  heldUntilResumed,
  moveOnTargets,
  nextOf,
} from '@/lib/hold';
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

describe('nextOf', () => {
  const spec = station({
    id: 'spec',
    key: 'spec',
    name: 'Spec',
    position: 0,
    harness: 'claude-code',
  });

  it('picks the next station on the line before one the task came from', () => {
    expect(nextOf([spec, review], build)?.id).toBe('review');
  });

  it('picks an earlier station when the line goes on to none', () => {
    expect(nextOf([spec], build)?.id).toBe('spec');
  });
});

describe('heldUntilResumed', () => {
  const hold = {
    by: { id: 'user_2', name: 'Maya Chen', image: null },
    startedAt: '2026-11-16T09:00:00.000Z',
    runId: null,
    heldMoveTo: null,
    chatId: null,
    viewerDrives: true,
    viewerEnds: true,
  };

  it('names who put the task on hold and since when, and speaks to them as you', () => {
    vi.setSystemTime(new Date('2026-11-16T09:12:00.000Z'));

    expect(heldUntilResumed(hold, 'user_1')).toBe(
      'Maya Chen put the task on hold 12m ago. The line continues when a person on the team resumes it.',
    );
    expect(heldUntilResumed(hold, 'user_2')).toBe(
      'You put the task on hold 12m ago. The line continues when a person on the team resumes it.',
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

describe('resumeChoices', () => {
  it('names the station to move on to when there is only one', () => {
    expect(
      resumeChoices(build, [review], null).map((each) => each.label),
    ).toEqual(['Resume at Build', 'Move on to Review', 'Finish the task']);
  });

  it('offers finishing once when an event already asked to finish the task', () => {
    expect(
      resumeChoices(build, [], completed).map((each) => each.label),
    ).toEqual(['Resume the line']);
  });
});

describe('resumedTo', () => {
  it('says what the line does next', () => {
    expect(resumedTo('continue', build, undefined, null)).toBe(
      'Build runs again with your changes.',
    );
    expect(resumedTo('move-on', build, review, null)).toBe(
      'The task moved to Review.',
    );
    expect(resumedTo('finish', build, undefined, null)).toBe(
      'The task is completed.',
    );
    expect(resumedTo('continue', build, undefined, completed)).toBe(
      'The task is completed.',
    );
  });
});

describe('resumeAction', () => {
  it('names the outcome on the button', () => {
    expect(resumeAction('continue')).toBe('Resume');
    expect(resumeAction('move-on')).toBe('Move it on');
    expect(resumeAction('finish')).toBe('Finish the task');
  });
});

describe('resumeNotePrompt', () => {
  it('asks for the note the next reader needs', () => {
    expect(resumeNotePrompt('continue', build, undefined, null)).toBe(
      'What should Build do next? (optional)',
    );
    expect(resumeNotePrompt('move-on', build, review, null)).toBe(
      'What should Review know? (optional)',
    );
    expect(resumeNotePrompt('finish', build, undefined, null)).toBe(
      'Note for your team (optional)',
    );
    expect(resumeNotePrompt('continue', build, undefined, completed)).toBe(
      'Note for your team (optional)',
    );
  });
});
