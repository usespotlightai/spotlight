import { PollCursor } from '@integrations/domain/aggregates/poll-cursor.aggregate';
import { InvalidCursorTransitionError } from '@integrations/domain/exceptions/invalid-cursor-transition.error';
import { DeclaredHappening } from '@integrations/domain/value-objects/declared-happening.vo';
import { HappeningName } from '@integrations/domain/value-objects/happening-name.vo';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { MarkKind } from '@integrations/domain/value-objects/mark-kind.vo';
import { Poll } from '@integrations/domain/value-objects/poll.vo';
import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-07T10:00:00.000Z');

const poll = Poll.of({
  every: 60,
  declares: [
    DeclaredHappening.of({
      happening: HappeningName.of('linear.issue.completed'),
      label: 'Done',
      summary: 'Done.',
      finds: [MarkKind.of('linear.issue')],
    }),
  ],
});

const started = () =>
  PollCursor.start(TeamId.of('team_1'), IntegrationKey.of('linear'));

const stored = (polledAt: Date | null, cursor: string | null = 'ENG-0') =>
  PollCursor.rehydrate({
    teamId: TeamId.of('team_1'),
    integration: IntegrationKey.of('linear'),
    cursor,
    polledAt,
    version: 1,
  });

describe('PollCursor', () => {
  it('is due the first time, and claimed by the poll that takes it', () => {
    const cursor = started();

    expect(cursor.isNew).toBe(true);
    expect(cursor.isDue(poll, NOW)).toBe(true);
    expect(cursor.claimed(poll, NOW).polledAt).toEqual(NOW);
  });

  it('cannot be claimed before its interval has passed', () => {
    const cursor = stored(new Date(NOW.getTime() - 30_000));

    expect(cursor.isDue(poll, NOW)).toBe(false);
    expect(() => cursor.claimed(poll, NOW)).toThrow(
      InvalidCursorTransitionError,
    );
  });

  it('moves its cursor only after a poll', () => {
    expect(() => started().advancedTo('ENG-2')).toThrow(
      InvalidCursorTransitionError,
    );
    expect(stored(NOW).advancedTo('ENG-2').cursor).toBe('ENG-2');
  });

  it('refuses a stored cursor without a version', () => {
    expect(() =>
      PollCursor.rehydrate({
        teamId: TeamId.of('team_1'),
        integration: IntegrationKey.of('linear'),
        cursor: null,
        polledAt: null,
        version: 0,
      }),
    ).toThrow(InconsistentStateError);
  });
});
