import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { ChatMessage } from '@work/domain/entities/chat-message.entity';
import { ChatMessageBody } from '@work/domain/value-objects/chat-message-body.vo';
import { MessagePosition } from '@work/domain/value-objects/message-position.vo';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-09-26T09:00:00.000Z');
const RUN = RunId.of('run_1');

const message = () =>
  ChatMessage.sent({
    position: MessagePosition.of(0),
    by: UserId.of('user_1'),
    body: ChatMessageBody.of('Split it.'),
    at: NOW,
  });

describe('ChatMessage', () => {
  it('remembers the run that acknowledged it', () => {
    const acknowledged = message().acknowledge(RUN, NOW);

    expect(acknowledged.unacknowledged).toBe(false);
    expect(acknowledged.wasAcknowledgedBy(RUN)).toBe(true);
    expect(acknowledged.wasAcknowledgedBy(RunId.of('run_2'))).toBe(false);
  });

  it('keeps the run that acknowledged it first', () => {
    const acknowledged = message()
      .acknowledge(RUN, NOW)
      .acknowledge(RunId.of('run_2'), NOW);

    expect(acknowledged.wasAcknowledgedBy(RUN)).toBe(true);
  });

  it('waits to be acknowledged again once unacknowledged', () => {
    const back = message().acknowledge(RUN, NOW).unacknowledge();

    expect(back.unacknowledged).toBe(true);
    expect(back.wasAcknowledgedBy(RUN)).toBe(false);
  });

  it('cannot be unacknowledged when no run acknowledged it', () => {
    expect(() => message().unacknowledge()).toThrow(InconsistentStateError);
  });

  it('does not name the run that acknowledged it without the time', () => {
    expect(() =>
      ChatMessage.rehydrate({
        position: MessagePosition.of(0),
        kind: 'message',
        body: ChatMessageBody.of('Split it.'),
        at: NOW,
        author: UserId.of('user_1'),
        runId: null,
        attachments: [],
        traces: [],
        proposal: null,
        acknowledgedAt: null,
        acknowledgedBy: RUN,
      }),
    ).toThrow(InconsistentStateError);
  });
});
