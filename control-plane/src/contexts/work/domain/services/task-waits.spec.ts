import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { MessagedTask } from '@work/domain/services/message-effect';
import { TaskWaits } from '@work/domain/services/task-waits';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';
import { describe, expect, it } from 'vitest';

const ALICE = UserId.of('user_alice');
const BOB = UserId.of('user_bob');
const ADA = UserId.of('user_ada');

const member = TeamStanding.of({
  seesTeam: true,
  actsOnTeam: true,
  memberOfTeam: true,
});
const admin = TeamStanding.of({
  seesTeam: true,
  actsOnTeam: true,
  memberOfTeam: false,
});

const task = (over: Partial<MessagedTask> = {}): MessagedTask => ({
  running: false,
  finished: false,
  atCompleted: false,
  harnessed: true,
  hold: null,
  pending: { assignee: ALICE, ask: null },
  ...over,
});

describe('TaskWaits', () => {
  it('waits for Alice, the assignee, whose message to the task answers it', () => {
    expect(
      TaskWaits.forViewer(task(), { person: ALICE, team: member }),
    ).toEqual({ waitingForYou: true, yourMessage: 'answer' });
  });

  it('does not wait for Bob, whose message is refused while the task waits for Alice', () => {
    expect(TaskWaits.forViewer(task(), { person: BOB, team: member })).toEqual({
      waitingForYou: false,
      yourMessage: 'awaits-another',
    });
  });

  it('waits for every member of the team while the task has no assignee, but not for an admin off the team', () => {
    const unassigned = task({ pending: { assignee: null, ask: null } });

    expect(
      TaskWaits.forViewer(unassigned, { person: BOB, team: member }),
    ).toEqual({ waitingForYou: true, yourMessage: 'answer' });
    expect(
      TaskWaits.forViewer(unassigned, { person: ADA, team: admin }),
    ).toEqual({ waitingForYou: false, yourMessage: 'awaits-another' });
  });

  it('waits for nobody while nothing is asked, and a message to the task holds nothing, from a member or an admin off the team', () => {
    const quiet = task({ pending: null });

    expect(TaskWaits.forViewer(quiet, { person: BOB, team: member })).toEqual({
      waitingForYou: false,
      yourMessage: 'message',
    });
    expect(TaskWaits.forViewer(quiet, { person: ADA, team: admin })).toEqual({
      waitingForYou: false,
      yourMessage: 'message',
    });
  });

  it('sends a task finished at a work station back to it with a message to the task', () => {
    expect(
      TaskWaits.forViewer(task({ pending: null, finished: true }), {
        person: ADA,
        team: admin,
      }),
    ).toEqual({ waitingForYou: false, yourMessage: 'reopens' });
  });
});
