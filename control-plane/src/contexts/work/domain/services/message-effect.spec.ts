import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import type { Awaiting } from '@work/domain/services/conversation-audience';
import {
  type MessageAddress,
  MessageEffect,
  type MessagedTask,
  TO_THE_TASK,
} from '@work/domain/services/message-effect';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { TeamStanding } from '@work/domain/value-objects/team-standing.vo';
import { describe, expect, it } from 'vitest';

const ANA = UserId.of('user_1');
const BEN = UserId.of('user_2');

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
const onlySees = TeamStanding.of({
  seesTeam: true,
  actsOnTeam: false,
  memberOfTeam: false,
});

const question: Awaiting = { assignee: ANA, ask: null };
const unassigned: Awaiting = { assignee: null, ask: null };
const approvalOfBen: Awaiting = {
  assignee: ANA,
  ask: { approval: { open: true, askedOf: BEN }, connectionAsk: null },
};
const connectionOfBen: Awaiting = {
  assignee: ANA,
  ask: { approval: null, connectionAsk: { met: false, personId: BEN } },
};
const turnsHold = { chat: null };
const chatHold = { chat: ChatId.of('chat_1') };

const CURRENT_RUN: MessageAddress = {
  toRun: true,
  currentRun: true,
  atTaskStation: true,
};
const AT_THE_STATION: MessageAddress = {
  toRun: true,
  currentRun: false,
  atTaskStation: true,
};
const ELSEWHERE: MessageAddress = {
  toRun: true,
  currentRun: false,
  atTaskStation: false,
};

const task = (over: Partial<MessagedTask> = {}): MessagedTask => ({
  running: true,
  finished: false,
  atCompleted: false,
  harnessed: true,
  hold: null,
  pending: null,
  ...over,
});

const outcome = (
  messaged: MessagedTask,
  person: UserId,
  team: TeamStanding,
  to: MessageAddress = CURRENT_RUN,
) => MessageEffect.outcome(messaged, to, { person, team });

describe('MessageEffect', () => {
  describe('addressTo', () => {
    const HERE = StationId.of('station_here');
    const THERE = StationId.of('station_there');

    it('addresses the task itself when no run is named', () => {
      expect(MessageEffect.addressTo(null, HERE)).toBe(TO_THE_TASK);
    });

    it('addresses a run at the task station, current or not', () => {
      expect(
        MessageEffect.addressTo({ current: true, stationId: HERE }, HERE),
      ).toEqual({ toRun: true, currentRun: true, atTaskStation: true });
      expect(
        MessageEffect.addressTo({ current: false, stationId: HERE }, HERE),
      ).toEqual({ toRun: true, currentRun: false, atTaskStation: true });
    });

    it('addresses a run away from the task station, or at no station, as moved on', () => {
      expect(
        MessageEffect.addressTo({ current: false, stationId: THERE }, HERE),
      ).toEqual({ toRun: true, currentRun: false, atTaskStation: false });
      expect(
        MessageEffect.addressTo({ current: false, stationId: null }, HERE),
      ).toEqual({ toRun: true, currentRun: false, atTaskStation: false });
    });
  });

  describe('answers', () => {
    it('answers through the current run of the task', () => {
      expect(MessageEffect.answers(true, CURRENT_RUN)).toBe(true);
    });

    it('answers through any run at the station of a task that is not running', () => {
      expect(MessageEffect.answers(false, AT_THE_STATION)).toBe(true);
    });

    it('answers nothing through an older run while another run works, or through a run at another station', () => {
      expect(MessageEffect.answers(true, AT_THE_STATION)).toBe(false);
      expect(MessageEffect.answers(false, ELSEWHERE)).toBe(false);
    });
  });

  describe('outcome', () => {
    it('answers the question with a message from the person it waits for', () => {
      expect(outcome(task({ pending: question }), ANA, member)).toBe('answer');
      expect(outcome(task({ pending: unassigned }), BEN, member)).toBe(
        'answer',
      );
    });

    it('answers a question no run asked with a message to a run at the station of a task that is not running', () => {
      expect(
        outcome(
          task({ running: false, pending: question }),
          ANA,
          member,
          AT_THE_STATION,
        ),
      ).toBe('answer');
    });

    it('refuses a message from another member while the question waits for the assignee', () => {
      expect(outcome(task({ pending: question }), BEN, member)).toBe(
        'awaits-another',
      );
    });

    it('refuses a message from an admin off the team while the question waits for its team', () => {
      expect(outcome(task({ pending: unassigned }), BEN, admin)).toBe(
        'awaits-another',
      );
    });

    it('answers with a message from the person an unmet connection names', () => {
      expect(outcome(task({ pending: connectionOfBen }), BEN, admin)).toBe(
        'answer',
      );
    });

    it('puts the task on hold on a member’s message while an approval waits, because an approval takes a decision', () => {
      for (const person of [ANA, BEN]) {
        expect(outcome(task({ pending: approvalOfBen }), person, member)).toBe(
          'holds',
        );
      }
    });

    it('puts the task on hold on a member’s message to its station while nothing waits', () => {
      expect(outcome(task(), BEN, member)).toBe('holds');
      expect(
        outcome(task({ running: false }), BEN, member, AT_THE_STATION),
      ).toBe('holds');
    });

    it('adds a message to the task itself and puts nothing on hold, from Ana, Ben and an admin off the team alike', () => {
      for (const [person, team] of [
        [ANA, member],
        [BEN, member],
        [BEN, admin],
      ] as const) {
        expect(
          outcome(task({ running: false }), person, team, TO_THE_TASK),
        ).toBe('message');
        expect(outcome(task(), person, team, TO_THE_TASK)).toBe('message');
      }
    });

    it('adds a message to an older run while a question waits on the current run, and holds nothing', () => {
      for (const [person, team] of [
        [ANA, member],
        [BEN, member],
        [BEN, admin],
      ] as const) {
        expect(
          outcome(task({ pending: question }), person, team, AT_THE_STATION),
        ).toBe('message');
      }

      expect(
        outcome(task({ pending: approvalOfBen }), BEN, member, AT_THE_STATION),
      ).toBe('holds');
      expect(
        outcome(task({ pending: approvalOfBen }), BEN, admin, AT_THE_STATION),
      ).toBe('not-on-team');
    });

    it('refuses a message from an admin off the team that would put the task on hold, because a hold assigns the task', () => {
      expect(outcome(task(), BEN, admin)).toBe('not-on-team');
      expect(outcome(task({ pending: approvalOfBen }), BEN, admin)).toBe(
        'not-on-team',
      );
    });

    it('adds a message where a message holds nothing: at a station with no harness, on a task finished in Completed', () => {
      expect(outcome(task({ harnessed: false }), BEN, admin)).toBe('message');
      expect(
        outcome(task({ finished: true, atCompleted: true }), BEN, admin),
      ).toBe('message');
    });

    it('refuses a message to a run at a station the task has left, from Ana, Ben and an admin off the team alike', () => {
      for (const [person, team] of [
        [ANA, member],
        [BEN, member],
        [BEN, admin],
      ] as const) {
        expect(
          outcome(task({ pending: question }), person, team, ELSEWHERE),
        ).toBe('moved-on');
      }
    });

    it('sends a task finished at a work station back to it, from anybody who acts on the team', () => {
      const finished = task({ running: false, finished: true });

      expect(outcome(finished, BEN, member, AT_THE_STATION)).toBe('reopens');
      expect(outcome(finished, BEN, admin, AT_THE_STATION)).toBe('reopens');
      expect(
        outcome({ ...finished, harnessed: false }, BEN, admin, AT_THE_STATION),
      ).toBe('reopens');
      expect(outcome(finished, BEN, member, ELSEWHERE)).toBe('moved-on');
      expect(outcome(finished, BEN, onlySees, AT_THE_STATION)).toBe(
        'not-acting',
      );
    });

    it('answers with a message from anybody who drives a hold, and drives the next turn when nothing is asked', () => {
      expect(
        outcome(task({ pending: question, hold: turnsHold }), BEN, admin),
      ).toBe('answer');
      expect(outcome(task({ hold: turnsHold }), BEN, admin)).toBe('drives');
      expect(outcome(task({ hold: turnsHold }), ANA, member)).toBe('drives');
      expect(
        outcome(task({ pending: approvalOfBen, hold: turnsHold }), BEN, member),
      ).toBe('drives');
    });

    it('keeps a message for the agent chat that holds the task, an answer too', () => {
      expect(
        outcome(task({ pending: question, hold: chatHold }), BEN, member),
      ).toBe('waits-for-chat');
      expect(outcome(task({ hold: chatHold }), ANA, admin)).toBe(
        'waits-for-chat',
      );
    });

    it('refuses a message from anybody who does not act on the team, the assignee too', () => {
      for (const team of [onlySees, TeamStanding.outside()]) {
        expect(outcome(task({ pending: question }), ANA, team)).toBe(
          'not-acting',
        );
        expect(outcome(task({ hold: turnsHold }), BEN, team)).toBe(
          'not-acting',
        );
      }
    });
  });
});
