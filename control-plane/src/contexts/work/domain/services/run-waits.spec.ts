import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { RunWaits, runWaitsOnAPerson } from '@work/domain/services/run-waits';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';
import { describe, expect, it } from 'vitest';

describe('runWaitsOnAPerson', () => {
  it('waits on a person while the current run of the task is suspended and nothing works it', () => {
    expect(
      runWaitsOnAPerson({
        state: 'suspended',
        progress: null,
        review: null,
        holdsRun: true,
      }),
    ).toBe(true);
  });

  it('does not wait for an older suspended run that the task no longer holds', () => {
    expect(
      runWaitsOnAPerson({
        state: 'suspended',
        progress: null,
        review: null,
        holdsRun: false,
      }),
    ).toBe(false);
  });

  it('does not wait while a suspended run is queued to go on', () => {
    expect(
      runWaitsOnAPerson({
        state: 'suspended',
        progress: 'queued',
        review: null,
        holdsRun: true,
      }),
    ).toBe(false);
  });

  it('waits on a person while the question the run asked is not answered', () => {
    expect(
      runWaitsOnAPerson({
        state: 'completed',
        progress: null,
        review: 'pending',
        holdsRun: false,
      }),
    ).toBe(true);
    expect(
      runWaitsOnAPerson({
        state: 'completed',
        progress: null,
        review: 'answered',
        holdsRun: false,
      }),
    ).toBe(false);
  });

  it('does not wait for a run that ended without a question', () => {
    expect(
      runWaitsOnAPerson({
        state: 'failed',
        progress: null,
        review: null,
        holdsRun: true,
      }),
    ).toBe(false);
  });
});

describe('RunWaits', () => {
  const ALICE = UserId.of('user_alice');
  const BOB = UserId.of('user_bob');
  const member = TeamStanding.of({
    seesTeam: true,
    actsOnTeam: true,
    memberOfTeam: true,
  });
  const awaitingAlice = {
    waits: true,
    task: {
      running: true,
      finished: false,
      atCompleted: false,
      harnessed: true,
      hold: null,
      pending: { assignee: ALICE, ask: null },
    },
    to: { toRun: true, currentRun: true, atTaskStation: true },
  };

  it('waits for the assignee, who answers with a message', () => {
    expect(
      RunWaits.forViewer(awaitingAlice, { person: ALICE, team: member }),
    ).toEqual({ waitingForYou: true, yourMessage: 'answer' });
  });

  it('refuses a message from Bob while it waits for Alice', () => {
    expect(
      RunWaits.forViewer(awaitingAlice, { person: BOB, team: member }),
    ).toEqual({ waitingForYou: false, yourMessage: 'awaits-another' });
  });

  it('lets Bob answer while he drives a hold of the task, though it waits for Alice', () => {
    expect(
      RunWaits.forViewer(
        {
          ...awaitingAlice,
          task: { ...awaitingAlice.task, hold: { chat: null } },
        },
        { person: BOB, team: member },
      ),
    ).toEqual({ waitingForYou: false, yourMessage: 'answer' });
  });

  it('keeps a message for the agent chat that holds the task', () => {
    expect(
      RunWaits.forViewer(
        {
          ...awaitingAlice,
          task: { ...awaitingAlice.task, hold: { chat: ChatId.of('chat_1') } },
        },
        { person: ALICE, team: member },
      ),
    ).toEqual({ waitingForYou: true, yourMessage: 'waits-for-chat' });
  });

  it('does not wait where the run itself waits for nobody, though a message to it answers the task’s question', () => {
    expect(
      RunWaits.forViewer(
        {
          ...awaitingAlice,
          waits: false,
          task: { ...awaitingAlice.task, running: false },
          to: { toRun: true, currentRun: false, atTaskStation: true },
        },
        { person: ALICE, team: member },
      ),
    ).toEqual({ waitingForYou: false, yourMessage: 'answer' });
  });
});
