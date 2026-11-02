import { TaskProposal } from '@work/domain/entities/task-proposal.entity';
import { ChatReply } from '@work/domain/value-objects/chat-reply.vo';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { ProposalPlacement } from '@work/domain/value-objects/proposal-placement.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it } from 'vitest';

const proposal = (
  position: number,
  title: string,
  state: 'open' | 'dismissed' = 'open',
) =>
  TaskProposal.rehydrate({
    position: MessagePosition.of(position),
    placement: ProposalPlacement.of({
      lineId: LineId.of('line_1'),
      stationId: StationId.of('station_1'),
    }),
    title: TaskTitle.of(title),
    description: null,
    state,
    taskId: null,
    decidedAt: null,
  });

const RETRIES = { number: 1, proposal: proposal(2, 'Back off exponentially') };
const LOGS = { number: 2, proposal: proposal(4, 'Log each retry') };
const DROPPED = {
  number: 1,
  proposal: proposal(2, 'Back off exponentially', 'dismissed'),
};

describe('ChatReply', () => {
  it('reads plain words as a message', () => {
    const reply = ChatReply.read('  Why do retries fail?  ');

    expect(reply.decision).toBeNull();
    expect(reply.text).toBe('Why do retries fail?');
  });

  it('reads a decision on a proposal, with or without its number', () => {
    expect(ChatReply.read('accept').decision).toBe('accept');
    expect(ChatReply.read('Dismiss 2').decision).toBe('dismiss');
    expect(ChatReply.read('accept #2').number).toBe(2);
    expect(ChatReply.read('accept.').number).toBeNull();
  });

  it('reads a sentence that starts with a decision as a message', () => {
    expect(ChatReply.read('accept the first one please').decision).toBeNull();
  });

  it('picks the only open proposal when no number is given', () => {
    expect(ChatReply.read('accept').pick([RETRIES])).toEqual({
      kind: 'picked',
      proposal: RETRIES.proposal,
    });
  });

  it('picks an open proposal by its number, counted from one', () => {
    expect(ChatReply.read('accept 2').pick([RETRIES, LOGS])).toEqual({
      kind: 'picked',
      proposal: LOGS.proposal,
    });
  });

  it('keeps the number of a proposal when one before it is decided', () => {
    expect(ChatReply.read('accept 2').pick([DROPPED, LOGS])).toEqual({
      kind: 'picked',
      proposal: LOGS.proposal,
    });
    expect(ChatReply.read('accept 1').pick([DROPPED, LOGS])).toEqual({
      kind: 'no-such',
      number: 1,
    });
    expect(ChatReply.read('accept').pick([DROPPED, LOGS])).toEqual({
      kind: 'picked',
      proposal: LOGS.proposal,
    });
  });

  it('asks for a number when more than one proposal is open', () => {
    expect(ChatReply.read('accept').pick([RETRIES, LOGS])).toEqual({
      kind: 'unnamed',
      open: 2,
    });
  });

  it('says when there is no open proposal, or none with that number', () => {
    expect(ChatReply.read('dismiss').pick([])).toEqual({ kind: 'none-open' });
    expect(ChatReply.read('accept 3').pick([RETRIES, LOGS])).toEqual({
      kind: 'no-such',
      number: 3,
    });
  });
});
