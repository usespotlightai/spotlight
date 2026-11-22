import { InvalidOutcomeError } from '@insights/domain/exceptions/invalid-outcome.error';
import { PersonAction } from '@insights/domain/value-objects/person-action.vo';
import { RunActions } from '@insights/domain/value-objects/run-actions.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { describe, expect, it } from 'vitest';

const ACTOR = UserId.of('user_actor');

const EARLIER = new Date('2026-11-21T09:00:00.000Z');
const AT = new Date('2026-11-21T10:00:00.000Z');
const LATER = new Date('2026-11-21T11:00:00.000Z');

const acted = (kind: Parameters<typeof PersonAction.of>[0], at: Date) =>
  PersonAction.of(kind, at, ACTOR);

describe('RunActions', () => {
  it.each([
    { decidingAction: acted('answered', AT), answer: null },
    { decidingAction: acted('approved', AT), answer: null },
    { decidingAction: null, answer: acted('accepted', AT) },
    { decidingAction: null, answer: acted('dismissed', AT) },
  ])(
    'is decided only by a deciding action, and answered only by an answer: %o',
    (actions) => {
      expect(() => RunActions.of(actions)).toThrow(InvalidOutcomeError);
    },
  );

  it('keeps the earliest deciding action and the earliest answer apart, in any order', () => {
    const actions = [
      acted('started', LATER),
      acted('answered', LATER),
      acted('sent-back', AT),
      acted('answered', EARLIER),
    ];
    const forwards = actions.reduce(
      (kept, each) => kept.with(each),
      RunActions.NONE,
    );
    const backwards = actions.reduceRight(
      (kept, each) => kept.with(each),
      RunActions.NONE,
    );

    for (const kept of [forwards, backwards]) {
      expect(kept.decidingAction).toEqual(acted('sent-back', AT));
      expect(kept.answer).toEqual(acted('answered', EARLIER));
    }
  });

  it('is not changed by answering an approval', () => {
    const actions = RunActions.NONE.with(acted('accepted', AT));

    expect(actions.with(acted('approved', EARLIER))).toBe(actions);
    expect(actions.with(acted('dismissed', EARLIER))).toBe(actions);
  });

  it('shows its deciding action as its human action, or else its answer', () => {
    const answered = RunActions.NONE.with(acted('answered', AT));

    expect(RunActions.NONE.humanAction).toBeNull();
    expect(answered.humanAction?.kind).toBe('answered');
    expect(answered.with(acted('started', LATER)).humanAction?.kind).toBe(
      'started',
    );
  });

  it('knows only what was done by a moment', () => {
    const actions = RunActions.NONE.with(acted('answered', AT)).with(
      acted('accepted', LATER),
    );
    const knownBy = (moment: Date) => (at: Date) =>
      at.getTime() <= moment.getTime();

    expect(actions.knownBy(knownBy(EARLIER))).toEqual(RunActions.NONE);
    expect(actions.knownBy(knownBy(AT)).humanAction?.kind).toBe('answered');
    expect(actions.knownBy(knownBy(LATER)).humanAction?.kind).toBe('accepted');
  });
});
