import { IntegrationCursors } from '@integrations/application/services/integration-cursors.service';
import { PollCursor } from '@integrations/domain/aggregates/poll-cursor.aggregate';
import { ScheduleCursor } from '@integrations/domain/aggregates/schedule-cursor.aggregate';
import type { PollCursorRepository } from '@integrations/domain/repositories/poll-cursor.repository';
import type { ScheduleCursorRepository } from '@integrations/domain/repositories/schedule-cursor.repository';
import { IntegrationKey } from '@integrations/domain/value-objects/integration-key.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TEAM = TeamId.of('team_1');
const LINEAR = IntegrationKey.of('linear');

const polled = PollCursor.rehydrate({
  teamId: TEAM,
  integration: LINEAR,
  cursor: 'c_9',
  polledAt: new Date('2026-09-01T00:00:00.000Z'),
  version: 3,
});

const ran = ScheduleCursor.rehydrate({
  teamId: TEAM,
  integration: LINEAR,
  ranAt: new Date('2026-09-01T00:00:00.000Z'),
  version: 2,
});

const cursorsWith = (poll: PollCursor, schedule: ScheduleCursor) => {
  const polls = {
    of: vi.fn(async () => poll),
    ofTeam: vi.fn(async () => [poll]),
    save: vi.fn(),
    remove: vi.fn(async () => {}),
  } satisfies PollCursorRepository;
  const schedules = {
    of: vi.fn(async () => schedule),
    ofTeam: vi.fn(async () => [schedule]),
    save: vi.fn(),
    remove: vi.fn(async () => {}),
  } satisfies ScheduleCursorRepository;

  return {
    cursors: new IntegrationCursors(polls, schedules),
    polls,
    schedules,
  };
};

describe('IntegrationCursors', () => {
  it('removes the stored cursors of a deleted integration, so a new one starts afresh', async () => {
    const { cursors, polls, schedules } = cursorsWith(polled, ran);

    await cursors.removePollCursorOf(TEAM, LINEAR);
    await cursors.removeScheduleCursorOf(TEAM, LINEAR);

    expect(polls.remove).toHaveBeenCalledWith(polled);
    expect(schedules.remove).toHaveBeenCalledWith(ran);
  });

  it('removes nothing for an integration that never polled or ran', async () => {
    const { cursors, polls, schedules } = cursorsWith(
      PollCursor.start(TEAM, LINEAR),
      ScheduleCursor.start(TEAM, LINEAR),
    );

    await cursors.removePollCursorOf(TEAM, LINEAR);
    await cursors.removeScheduleCursorOf(TEAM, LINEAR);

    expect(polls.remove).not.toHaveBeenCalled();
    expect(schedules.remove).not.toHaveBeenCalled();
  });

  it('removes every cursor of a deleted team', async () => {
    const { cursors, polls, schedules } = cursorsWith(polled, ran);

    await cursors.removePollCursorsOfTeam(TEAM);
    await cursors.removeScheduleCursorsOfTeam(TEAM);

    expect(polls.remove).toHaveBeenCalledWith(polled);
    expect(schedules.remove).toHaveBeenCalledWith(ran);
  });
});
